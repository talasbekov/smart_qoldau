import type { components } from '@/lib/api/generated';

export type ExpertMe = components['schemas']['ExpertMeDto'];
// OpenAPI generation is coordinated at integration time; `comment` is a
// owner-only addition to the document-list response used for re-upload help.
export type ExpertDocument = components['schemas']['ExpertDocumentDto'] & { comment?: string | null };
export type Topic = { slug: string; name: string };

export const documentTypes = ['IDENTITY', 'DIPLOMA', 'CERTIFICATES', 'QUALIFICATION'] as const;
export type DocumentType = (typeof documentTypes)[number];

export const documentNames: Record<DocumentType, { ru: string; kz: string }> = {
  IDENTITY: { ru: 'Удостоверение личности', kz: 'Жеке куәлік' },
  DIPLOMA: { ru: 'Диплом об образовании', kz: 'Білім туралы диплом' },
  CERTIFICATES: { ru: 'Сертификаты', kz: 'Сертификаттар' },
  QUALIFICATION: { ru: 'Документы о квалификации', kz: 'Біліктілік құжаттары' },
};
