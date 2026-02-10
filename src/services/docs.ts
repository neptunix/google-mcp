import { google, type docs_v1, type Auth } from "googleapis";
import {
  type DocContent,
  type DocContentWithTabs,
  type TabInfo,
  type TabContent,
} from "../types/index.js";
import { DriveService } from "./drive.js";

export class DocsService {
  private readonly docs: docs_v1.Docs;
  private readonly drive: DriveService;

  constructor(authClient: Auth.OAuth2Client) {
    this.docs = google.docs({ version: "v1", auth: authClient });
    this.drive = new DriveService(authClient);
  }

  public async createDocument(title: string, content?: string, folderId?: string): Promise<DocContent> {
    // Create the document
    const response = await this.docs.documents.create({
      requestBody: {
        title,
      },
    });

    const documentId = response.data.documentId!;

    // If content is provided, insert it
    if (content) {
      await this.docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: content,
              },
            },
          ],
        },
      });
    }

    // If folderId is provided, move the document to that folder
    if (folderId) {
      await this.drive.moveFile(documentId, folderId);
    }

    return {
      documentId,
      title: response.data.title!,
      body: content,
    };
  }

  public async getDocument(documentId: string): Promise<DocContent> {
    // Delegate to tabs-aware method for backward compatibility
    const result = await this.getDocumentWithTabs(documentId);
    return {
      documentId: result.documentId,
      title: result.title,
      body: result.body,
      revisionId: result.revisionId,
    };
  }

  public async getDocumentWithTabs(
    documentId: string,
    tabId?: string
  ): Promise<DocContentWithTabs> {
    const response = await this.docs.documents.get({
      documentId,
      includeTabsContent: true, // Enable tab support
    });

    const doc = response.data;
    const tabs = this.extractTabsInfo(doc.tabs);
    const hasMultipleTabs =
      tabs.length > 1 || tabs.some((t) => t.childTabs && t.childTabs.length > 0);

    let body: string;
    let activeTabId: string | undefined;

    if (tabId) {
      // Read specific tab
      const tab = this.findTabInHierarchy(doc.tabs, tabId);
      if (!tab) {
        throw new Error(`Tab with ID "${tabId}" not found in document`);
      }
      body = this.extractTextFromBody(tab.documentTab?.body);
      activeTabId = tabId;
    } else {
      // Read first/default tab (maintain backward compatibility)
      if (doc.tabs && doc.tabs.length > 0) {
        body = this.extractTextFromBody(doc.tabs[0].documentTab?.body);
        activeTabId = doc.tabs[0].tabProperties?.tabId || undefined;
      } else {
        // Fallback to legacy body (shouldn't happen with includeTabsContent)
        body = this.extractTextFromBody(doc.body);
      }
    }

    return {
      documentId: doc.documentId!,
      title: doc.title!,
      body,
      revisionId: doc.revisionId || undefined,
      tabs,
      activeTabId,
      hasMultipleTabs,
    };
  }

  public async getDocumentTabs(documentId: string): Promise<TabInfo[]> {
    const response = await this.docs.documents.get({
      documentId,
      includeTabsContent: true,
    });

    return this.extractTabsInfo(response.data.tabs);
  }

  public async getTabContent(documentId: string, tabId: string): Promise<TabContent> {
    const response = await this.docs.documents.get({
      documentId,
      includeTabsContent: true,
    });

    const tabData = this.findTabWithParent(response.data.tabs, tabId);
    if (!tabData) {
      throw new Error(`Tab with ID "${tabId}" not found in document`);
    }

    const { tab, parentTabId } = tabData;

    return {
      tabId: tab.tabProperties?.tabId || tabId,
      title: tab.tabProperties?.title || "Untitled Tab",
      index: tab.tabProperties?.index || 0,
      body: this.extractTextFromBody(tab.documentTab?.body),
      parentTabId,
    };
  }

  private extractTabsInfo(tabs?: docs_v1.Schema$Tab[]): TabInfo[] {
    if (!tabs) return [];

    return tabs.map((tab) => ({
      tabId: tab.tabProperties?.tabId || "",
      title: tab.tabProperties?.title || "Untitled Tab",
      index: tab.tabProperties?.index || 0,
      childTabs: this.extractTabsInfo(tab.childTabs), // Recursive for nested tabs
    }));
  }

  private findTabInHierarchy(
    tabs: docs_v1.Schema$Tab[] | undefined,
    tabId: string
  ): docs_v1.Schema$Tab | null {
    if (!tabs) return null;

    for (const tab of tabs) {
      if (tab.tabProperties?.tabId === tabId) {
        return tab;
      }
      // Check child tabs recursively
      if (tab.childTabs) {
        const found = this.findTabInHierarchy(tab.childTabs, tabId);
        if (found) return found;
      }
    }
    return null;
  }

  private findTabWithParent(
    tabs: docs_v1.Schema$Tab[] | undefined,
    tabId: string,
    parentTabId?: string
  ): { tab: docs_v1.Schema$Tab; parentTabId?: string } | null {
    if (!tabs) return null;

    for (const tab of tabs) {
      if (tab.tabProperties?.tabId === tabId) {
        return { tab, parentTabId };
      }
      if (tab.childTabs) {
        const found = this.findTabWithParent(
          tab.childTabs,
          tabId,
          tab.tabProperties?.tabId || undefined
        );
        if (found) return found;
      }
    }
    return null;
  }

  private extractTextFromBody(body?: docs_v1.Schema$Body): string {
    let text = "";

    const content = body?.content;
    if (!content) return text;

    for (const element of content) {
      if (element.paragraph) {
        for (const paragraphElement of element.paragraph.elements || []) {
          if (paragraphElement.textRun?.content) {
            text += paragraphElement.textRun.content;
          }
        }
      } else if (element.table) {
        for (const row of element.table.tableRows || []) {
          for (const cell of row.tableCells || []) {
            for (const cellContent of cell.content || []) {
              if (cellContent.paragraph) {
                for (const paragraphElement of cellContent.paragraph.elements ||
                  []) {
                  if (paragraphElement.textRun?.content) {
                    text += paragraphElement.textRun.content;
                  }
                }
              }
            }
            text += "\t";
          }
          text += "\n";
        }
      }
    }

    return text;
  }

  public async insertText(
    documentId: string,
    text: string,
    index: number,
    tabId?: string
  ): Promise<void> {
    await this.docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: {
                index,
                tabId, // Optional: targets specific tab
              },
              text,
            },
          },
        ],
      },
    });
  }

  public async appendText(
    documentId: string,
    text: string,
    tabId?: string
  ): Promise<void> {
    // Get the document to find the end index
    const doc = await this.docs.documents.get({
      documentId,
      includeTabsContent: true,
    });

    let content: docs_v1.Schema$StructuralElement[] | undefined;

    if (tabId && doc.data.tabs) {
      const tab = this.findTabInHierarchy(doc.data.tabs, tabId);
      if (!tab) {
        throw new Error(`Tab with ID "${tabId}" not found`);
      }
      content = tab.documentTab?.body?.content;
    } else if (doc.data.tabs && doc.data.tabs.length > 0) {
      content = doc.data.tabs[0].documentTab?.body?.content;
    } else {
      content = doc.data.body?.content;
    }

    if (!content || content.length === 0) {
      await this.insertText(documentId, text, 1, tabId);
      return;
    }

    // Find the last element's end index
    const lastElement = content[content.length - 1];
    const endIndex = lastElement.endIndex ? lastElement.endIndex - 1 : 1;

    await this.insertText(documentId, text, endIndex, tabId);
  }

  public async deleteContent(documentId: string, startIndex: number, endIndex: number): Promise<void> {
    await this.docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            deleteContentRange: {
              range: {
                startIndex,
                endIndex,
              },
            },
          },
        ],
      },
    });
  }

  public async replaceAllText(
    documentId: string,
    searchText: string,
    replaceText: string,
    matchCase = true,
    tabId?: string
  ): Promise<number> {
    const replaceRequest: docs_v1.Schema$ReplaceAllTextRequest = {
      containsText: {
        text: searchText,
        matchCase,
      },
      replaceText,
    };

    // Target specific tab if provided
    if (tabId) {
      replaceRequest.tabsCriteria = { tabIds: [tabId] };
    }

    const response = await this.docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [{ replaceAllText: replaceRequest }],
      },
    });

    // Return the number of replacements made
    const replies = response.data.replies;
    if (replies && replies.length > 0 && replies[0].replaceAllText) {
      return replies[0].replaceAllText.occurrencesChanged || 0;
    }
    return 0;
  }

  public async insertTable(
    documentId: string,
    rows: number,
    columns: number,
    index: number
  ): Promise<void> {
    await this.docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertTable: {
              rows,
              columns,
              location: { index },
            },
          },
        ],
      },
    });
  }

  public async updateDocumentStyle(
    documentId: string,
    style: {
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      fontSize?: number;
    },
    startIndex: number,
    endIndex: number
  ): Promise<void> {
    const textStyle: docs_v1.Schema$TextStyle = {};
    const fields: string[] = [];

    if (style.bold !== undefined) {
      textStyle.bold = style.bold;
      fields.push("bold");
    }
    if (style.italic !== undefined) {
      textStyle.italic = style.italic;
      fields.push("italic");
    }
    if (style.underline !== undefined) {
      textStyle.underline = style.underline;
      fields.push("underline");
    }
    if (style.fontSize !== undefined) {
      textStyle.fontSize = {
        magnitude: style.fontSize,
        unit: "PT",
      };
      fields.push("fontSize");
    }

    await this.docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            updateTextStyle: {
              range: {
                startIndex,
                endIndex,
              },
              textStyle,
              fields: fields.join(","),
            },
          },
        ],
      },
    });
  }

  public async listDocuments(pageSize = 50, pageToken?: string): Promise<{
    documents: Array<{ id: string; name: string; modifiedTime?: string }>;
    nextPageToken?: string;
  }> {
    const result = await this.drive.listFiles({
      pageSize,
      pageToken,
      query: "mimeType = 'application/vnd.google-apps.document'",
      orderBy: "modifiedTime desc",
    });

    return {
      documents: result.files.map((f) => ({
        id: f.id,
        name: f.name,
        modifiedTime: f.modifiedTime,
      })),
      nextPageToken: result.nextPageToken,
    };
  }
}

