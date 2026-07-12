export type UploadedFileBuffer = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

export type FileResponse = {
  id: string;
  provider: string;
  purpose: string;
  bucket: string;
  objectKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  visibility: string;
  status: string;
  uploadedById: string | null;
  publicUrl: string | null;
  checksum: string | null;
  createdAt: Date;
  updatedAt: Date;
};
