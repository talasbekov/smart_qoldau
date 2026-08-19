import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  DocumentType,
  DocumentStatus,
  Expert,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { apiError } from '../common/filters/app-exception.filter';
import { ExpertDocumentDto, SubmitVerificationDto } from './dto/document.dto';

const DOCUMENT_TYPE_ORDER: DocumentType[] = [
  DocumentType.IDENTITY,
  DocumentType.DIPLOMA,
  DocumentType.CERTIFICATES,
  DocumentType.QUALIFICATION,
];

const UPLOADED_STATUSES: DocumentStatus[] = [
  DocumentStatus.UPLOADED,
  DocumentStatus.APPROVED,
];

const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private storage: StorageService,
  ) {}

  async upload(
    expert: Expert,
    type: DocumentType,
    file: Express.Multer.File,
  ): Promise<ExpertDocumentDto> {
    const ext = EXT_BY_MIME[file.mimetype] ?? 'bin';
    const fileKey = `experts/${expert.id}/${type}/${randomUUID()}.${ext}`;

    await this.storage.putObject(fileKey, file.buffer, file.mimetype);

    const doc = await this.prisma.expertDocument.upsert({
      where: { expertId_type: { expertId: expert.id, type } },
      create: {
        expertId: expert.id,
        type,
        status: DocumentStatus.UPLOADED,
        fileKey,
      },
      update: {
        status: DocumentStatus.UPLOADED,
        fileKey,
        comment: null,
      },
    });

    await this.audit.log({
      actorType: 'expert',
      actorId: expert.id,
      entity: 'expert',
      entityId: expert.id,
      transition: 'expert.document_uploaded',
      payload: { type },
    });

    return { type, status: doc.status, updatedAt: doc.updatedAt };
  }

  async list(expert: Expert): Promise<ExpertDocumentDto[]> {
    const docs = await this.prisma.expertDocument.findMany({
      where: { expertId: expert.id },
    });
    const byType = new Map(docs.map((d) => [d.type, d]));
    return DOCUMENT_TYPE_ORDER.map((type) => {
      const doc = byType.get(type);
      if (!doc) return { type, status: null };
      return { type, status: doc.status, updatedAt: doc.updatedAt };
    });
  }

  async submit(expert: Expert): Promise<SubmitVerificationDto> {
    if (expert.verificationStatus !== VerificationStatus.DRAFT)
      apiError(
        'INVALID_STATE_TRANSITION',
        'Отправка на проверку возможна только из черновика',
        400,
      );

    const docs = await this.prisma.expertDocument.findMany({
      where: { expertId: expert.id },
    });
    const byType = new Map(docs.map((d) => [d.type, d]));
    const complete = DOCUMENT_TYPE_ORDER.every((type) => {
      const doc = byType.get(type);
      return doc && UPLOADED_STATUSES.includes(doc.status);
    });
    if (!complete)
      apiError('DOCUMENTS_INCOMPLETE', 'Не все документы загружены', 400);

    const updated = await this.prisma.expert.update({
      where: { id: expert.id },
      data: { verificationStatus: VerificationStatus.PENDING },
    });

    await this.audit.log({
      actorType: 'expert',
      actorId: expert.id,
      entity: 'expert',
      entityId: expert.id,
      transition: 'expert.verification_submitted',
    });

    return { verificationStatus: updated.verificationStatus };
  }
}
