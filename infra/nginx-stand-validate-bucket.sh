#!/bin/sh
set -eu

bucket=${S3_BUCKET_CONTENT:-}
case "$bucket" in
  ''|*[!a-z0-9.-]*|.*|*.|*..*)
    echo 'S3_BUCKET_CONTENT must be a 3-63 character lowercase S3 bucket name' >&2
    exit 1
    ;;
esac
if [ "${#bucket}" -lt 3 ] || [ "${#bucket}" -gt 63 ]; then
  echo 'S3_BUCKET_CONTENT must be a 3-63 character lowercase S3 bucket name' >&2
  exit 1
fi
