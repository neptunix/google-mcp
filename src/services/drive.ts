import { google, type drive_v3, type Auth } from "googleapis";
import { type DriveFile, type DriveListOptions } from "../types/index.js";

export class DriveService {
  private readonly drive: drive_v3.Drive;

  constructor(authClient: Auth.OAuth2Client) {
    this.drive = google.drive({ version: "v3", auth: authClient });
  }

  public async listFiles(options: DriveListOptions = {}): Promise<{
    files: DriveFile[];
    nextPageToken?: string;
  }> {
    const { pageSize = 50, pageToken, query, orderBy, folderId } = options;

    let q = "trashed = false";

    if (folderId) {
      q += ` and '${folderId}' in parents`;
    }

    if (query) {
      q += ` and ${query}`;
    }

    const response = await this.drive.files.list({
      pageSize,
      pageToken,
      q,
      orderBy: orderBy || "modifiedTime desc",
      fields: "nextPageToken, files(id, name, mimeType, parents, webViewLink, createdTime, modifiedTime, size, owners)",
    });

    const files: DriveFile[] = (response.data.files || []).map((file) => ({
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      parents: file.parents || undefined,
      webViewLink: file.webViewLink || undefined,
      createdTime: file.createdTime || undefined,
      modifiedTime: file.modifiedTime || undefined,
      size: file.size || undefined,
      owners: file.owners?.map((o) => ({
        displayName: o.displayName || "",
        emailAddress: o.emailAddress || "",
      })),
    }));

    return {
      files,
      nextPageToken: response.data.nextPageToken || undefined,
    };
  }

  public async getFile(fileId: string): Promise<DriveFile> {
    const response = await this.drive.files.get({
      fileId,
      fields: "id, name, mimeType, parents, webViewLink, createdTime, modifiedTime, size, owners",
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      mimeType: response.data.mimeType!,
      parents: response.data.parents || undefined,
      webViewLink: response.data.webViewLink || undefined,
      createdTime: response.data.createdTime || undefined,
      modifiedTime: response.data.modifiedTime || undefined,
      size: response.data.size || undefined,
      owners: response.data.owners?.map((o) => ({
        displayName: o.displayName || "",
        emailAddress: o.emailAddress || "",
      })),
    };
  }

  public async downloadFile(fileId: string): Promise<string> {
    const file = await this.getFile(fileId);

    // Handle Google Workspace files differently
    if (file.mimeType.startsWith("application/vnd.google-apps.")) {
      let exportMimeType: string;

      switch (file.mimeType) {
        case "application/vnd.google-apps.document":
          exportMimeType = "text/plain";
          break;
        case "application/vnd.google-apps.spreadsheet":
          exportMimeType = "text/csv";
          break;
        case "application/vnd.google-apps.presentation":
          exportMimeType = "text/plain";
          break;
        default:
          exportMimeType = "text/plain";
      }

      const response = await this.drive.files.export({
        fileId,
        mimeType: exportMimeType,
      }, { responseType: "text" });

      return response.data as string;
    }

    // Regular files
    const response = await this.drive.files.get({
      fileId,
      alt: "media",
    }, { responseType: "text" });

    return response.data as string;
  }

  public async uploadFile(
    name: string,
    content: string,
    mimeType?: string,
    folderId?: string
  ): Promise<DriveFile> {
    const fileMetadata: drive_v3.Schema$File = {
      name,
      parents: folderId ? [folderId] : undefined,
    };

    const media = {
      mimeType: mimeType || "text/plain",
      body: content,
    };

    const response = await this.drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id, name, mimeType, parents, webViewLink, createdTime, modifiedTime",
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      mimeType: response.data.mimeType!,
      parents: response.data.parents || undefined,
      webViewLink: response.data.webViewLink || undefined,
      createdTime: response.data.createdTime || undefined,
      modifiedTime: response.data.modifiedTime || undefined,
    };
  }

  public async updateFile(
    fileId: string,
    content: string,
    mimeType?: string
  ): Promise<DriveFile> {
    const media = {
      mimeType: mimeType || "text/plain",
      body: content,
    };

    const response = await this.drive.files.update({
      fileId,
      media,
      fields: "id, name, mimeType, parents, webViewLink, createdTime, modifiedTime",
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      mimeType: response.data.mimeType!,
      parents: response.data.parents || undefined,
      webViewLink: response.data.webViewLink || undefined,
      createdTime: response.data.createdTime || undefined,
      modifiedTime: response.data.modifiedTime || undefined,
    };
  }

  public async deleteFile(fileId: string): Promise<void> {
    await this.drive.files.delete({ fileId });
  }

  public async createFolder(name: string, parentFolderId?: string): Promise<DriveFile> {
    const fileMetadata: drive_v3.Schema$File = {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentFolderId ? [parentFolderId] : undefined,
    };

    const response = await this.drive.files.create({
      requestBody: fileMetadata,
      fields: "id, name, mimeType, parents, webViewLink, createdTime, modifiedTime",
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      mimeType: response.data.mimeType!,
      parents: response.data.parents || undefined,
      webViewLink: response.data.webViewLink || undefined,
      createdTime: response.data.createdTime || undefined,
      modifiedTime: response.data.modifiedTime || undefined,
    };
  }

  public async search(query: string, pageSize = 50, pageToken?: string): Promise<{
    files: DriveFile[];
    nextPageToken?: string;
  }> {
    const response = await this.drive.files.list({
      pageSize,
      pageToken,
      q: `fullText contains '${query.replace(/'/g, "\\'")}' and trashed = false`,
      orderBy: "modifiedTime desc",
      fields: "nextPageToken, files(id, name, mimeType, parents, webViewLink, createdTime, modifiedTime, size)",
    });

    const files: DriveFile[] = (response.data.files || []).map((file) => ({
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      parents: file.parents || undefined,
      webViewLink: file.webViewLink || undefined,
      createdTime: file.createdTime || undefined,
      modifiedTime: file.modifiedTime || undefined,
      size: file.size || undefined,
    }));

    return {
      files,
      nextPageToken: response.data.nextPageToken || undefined,
    };
  }

  public async moveFile(fileId: string, newFolderId: string): Promise<DriveFile> {
    // Get current parents
    const file = await this.drive.files.get({
      fileId,
      fields: "parents",
    });

    const previousParents = file.data.parents?.join(",") || "";

    const response = await this.drive.files.update({
      fileId,
      addParents: newFolderId,
      removeParents: previousParents,
      fields: "id, name, mimeType, parents, webViewLink, createdTime, modifiedTime",
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      mimeType: response.data.mimeType!,
      parents: response.data.parents || undefined,
      webViewLink: response.data.webViewLink || undefined,
      createdTime: response.data.createdTime || undefined,
      modifiedTime: response.data.modifiedTime || undefined,
    };
  }

  public async copyFile(fileId: string, newName?: string, folderId?: string): Promise<DriveFile> {
    const requestBody: drive_v3.Schema$File = {};

    if (newName) {
      requestBody.name = newName;
    }

    if (folderId) {
      requestBody.parents = [folderId];
    }

    const response = await this.drive.files.copy({
      fileId,
      requestBody,
      fields: "id, name, mimeType, parents, webViewLink, createdTime, modifiedTime",
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      mimeType: response.data.mimeType!,
      parents: response.data.parents || undefined,
      webViewLink: response.data.webViewLink || undefined,
      createdTime: response.data.createdTime || undefined,
      modifiedTime: response.data.modifiedTime || undefined,
    };
  }

  public async renameFile(fileId: string, newName: string): Promise<DriveFile> {
    const response = await this.drive.files.update({
      fileId,
      requestBody: { name: newName },
      fields: "id, name, mimeType, parents, webViewLink, createdTime, modifiedTime",
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      mimeType: response.data.mimeType!,
      parents: response.data.parents || undefined,
      webViewLink: response.data.webViewLink || undefined,
      createdTime: response.data.createdTime || undefined,
      modifiedTime: response.data.modifiedTime || undefined,
    };
  }
}

