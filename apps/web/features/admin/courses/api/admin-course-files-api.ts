import { apiRequest } from "@/lib/api-client";
import type {
  SignedUrlApi,
  UploadedFileApi,
} from "@/features/admin/courses/types/admin-course-api-types";

export async function uploadAdminCourseCover(file: File, token: string) {
  const formData = new FormData();
  formData.set("purpose", "EDITOR_IMAGE");
  formData.set("file", file);

  const uploadedFile = await apiRequest<UploadedFileApi>("/files/upload", {
    method: "POST",
    body: formData,
    token,
  });
  const signedUrl = uploadedFile.publicUrl
    ? { url: uploadedFile.publicUrl }
    : await apiRequest<SignedUrlApi>(`/files/${uploadedFile.id}/signed-url`, {
        token,
      });

  return {
    fileId: uploadedFile.id,
    fileName: uploadedFile.originalName,
    imageUrl: signedUrl.url,
  };
}
