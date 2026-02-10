import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Auth } from "googleapis";

// Mock functions
const mockDocsCreate = vi.fn();
const mockDocsGet = vi.fn();
const mockDocsBatchUpdate = vi.fn();
const mockFilesList = vi.fn();
const mockFilesGet = vi.fn();
const mockFilesUpdate = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    docs: () => ({
      documents: {
        create: mockDocsCreate,
        get: mockDocsGet,
        batchUpdate: mockDocsBatchUpdate,
      },
    }),
    drive: () => ({
      files: {
        list: mockFilesList,
        get: mockFilesGet,
        update: mockFilesUpdate,
      },
    }),
  },
}));

import { DocsService } from "../services/docs.js";

describe("DocsService", () => {
  let service: DocsService;
  const mockAuth = {} as Auth.OAuth2Client;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DocsService(mockAuth);
  });

  describe("createDocument", () => {
    it("should create empty document", async () => {
      mockDocsCreate.mockResolvedValue({
        data: { documentId: "doc1", title: "New Doc" },
      });

      const result = await service.createDocument("New Doc");

      expect(mockDocsCreate).toHaveBeenCalled();
      expect(result.documentId).toBe("doc1");
      expect(result.title).toBe("New Doc");
    });

    it("should create document with content", async () => {
      mockDocsCreate.mockResolvedValue({
        data: { documentId: "doc1", title: "Doc" },
      });
      mockDocsBatchUpdate.mockResolvedValue({ data: {} });

      const result = await service.createDocument("Doc", "Initial content");

      expect(mockDocsBatchUpdate).toHaveBeenCalled();
      expect(result.body).toBe("Initial content");
    });

    it("should move document to folder", async () => {
      mockDocsCreate.mockResolvedValue({
        data: { documentId: "doc1", title: "Doc" },
      });
      mockFilesGet.mockResolvedValue({ data: { parents: [] } });
      mockFilesUpdate.mockResolvedValue({ data: {} });

      await service.createDocument("Doc", undefined, "folder1");

      expect(mockFilesUpdate).toHaveBeenCalled();
    });
  });

  describe("getDocument", () => {
    it("should get document with text", async () => {
      mockDocsGet.mockResolvedValue({
        data: {
          documentId: "doc1",
          title: "Test",
          revisionId: "rev1",
          body: {
            content: [
              { paragraph: { elements: [{ textRun: { content: "Hello " } }, { textRun: { content: "World" } }] } },
            ],
          },
        },
      });

      const result = await service.getDocument("doc1");

      expect(result.documentId).toBe("doc1");
      expect(result.body).toBe("Hello World");
    });

    it("should handle empty document", async () => {
      mockDocsGet.mockResolvedValue({
        data: { documentId: "doc1", title: "Empty", body: { content: [] } },
      });

      const result = await service.getDocument("doc1");

      expect(result.body).toBe("");
    });

    it("should extract text from tables", async () => {
      mockDocsGet.mockResolvedValue({
        data: {
          documentId: "doc1",
          title: "Table Doc",
          body: {
            content: [{
              table: {
                tableRows: [{
                  tableCells: [{
                    content: [{ paragraph: { elements: [{ textRun: { content: "Cell" } }] } }],
                  }],
                }],
              },
            }],
          },
        },
      });

      const result = await service.getDocument("doc1");

      expect(result.body).toContain("Cell");
    });
  });

  describe("insertText", () => {
    it("should insert text at index", async () => {
      mockDocsBatchUpdate.mockResolvedValue({ data: {} });

      await service.insertText("doc1", "New text", 10);

      expect(mockDocsBatchUpdate).toHaveBeenCalledWith({
        documentId: "doc1",
        requestBody: {
          requests: [{ insertText: { location: { index: 10 }, text: "New text" } }],
        },
      });
    });
  });

  describe("appendText", () => {
    it("should append text to end", async () => {
      mockDocsGet.mockResolvedValue({
        data: { body: { content: [{ endIndex: 50 }] } },
      });
      mockDocsBatchUpdate.mockResolvedValue({ data: {} });

      await service.appendText("doc1", "Appended");

      expect(mockDocsBatchUpdate).toHaveBeenCalled();
    });

    it("should handle empty document", async () => {
      mockDocsGet.mockResolvedValue({
        data: { body: { content: [] } },
      });
      mockDocsBatchUpdate.mockResolvedValue({ data: {} });

      await service.appendText("doc1", "First text");

      expect(mockDocsBatchUpdate).toHaveBeenCalledWith({
        documentId: "doc1",
        requestBody: {
          requests: [{ insertText: { location: { index: 1 }, text: "First text" } }],
        },
      });
    });
  });

  describe("deleteContent", () => {
    it("should delete content range", async () => {
      mockDocsBatchUpdate.mockResolvedValue({ data: {} });

      await service.deleteContent("doc1", 5, 20);

      expect(mockDocsBatchUpdate).toHaveBeenCalledWith({
        documentId: "doc1",
        requestBody: {
          requests: [{ deleteContentRange: { range: { startIndex: 5, endIndex: 20 } } }],
        },
      });
    });
  });

  describe("replaceAllText", () => {
    it("should replace all occurrences", async () => {
      mockDocsBatchUpdate.mockResolvedValue({
        data: { replies: [{ replaceAllText: { occurrencesChanged: 3 } }] },
      });

      const count = await service.replaceAllText("doc1", "old", "new");

      expect(count).toBe(3);
    });

    it("should return 0 when no replacements", async () => {
      mockDocsBatchUpdate.mockResolvedValue({
        data: { replies: [] },
      });

      const count = await service.replaceAllText("doc1", "notfound", "new");

      expect(count).toBe(0);
    });
  });

  describe("insertTable", () => {
    it("should insert table", async () => {
      mockDocsBatchUpdate.mockResolvedValue({ data: {} });

      await service.insertTable("doc1", 3, 4, 10);

      expect(mockDocsBatchUpdate).toHaveBeenCalledWith({
        documentId: "doc1",
        requestBody: {
          requests: [{ insertTable: { rows: 3, columns: 4, location: { index: 10 } } }],
        },
      });
    });
  });

  describe("updateDocumentStyle", () => {
    it("should apply text style", async () => {
      mockDocsBatchUpdate.mockResolvedValue({ data: {} });

      await service.updateDocumentStyle("doc1", { bold: true, fontSize: 14 }, 0, 10);

      expect(mockDocsBatchUpdate).toHaveBeenCalledWith({
        documentId: "doc1",
        requestBody: {
          requests: [{
            updateTextStyle: {
              range: { startIndex: 0, endIndex: 10 },
              textStyle: { bold: true, fontSize: { magnitude: 14, unit: "PT" } },
              fields: "bold,fontSize",
            },
          }],
        },
      });
    });
  });

  describe("listDocuments", () => {
    it("should list Google Docs", async () => {
      mockFilesList.mockResolvedValue({
        data: {
          files: [{ id: "doc1", name: "Doc 1", mimeType: "application/vnd.google-apps.document", modifiedTime: "2024-01-01" }],
          nextPageToken: "token",
        },
      });

      const result = await service.listDocuments();

      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].id).toBe("doc1");
    });
  });

  // Tab support tests
  const mockTabsResponse = {
    documentId: "doc1",
    title: "Multi-Tab Doc",
    revisionId: "rev1",
    tabs: [
      {
        tabProperties: { tabId: "tab1", title: "First Tab", index: 0 },
        documentTab: {
          body: {
            content: [
              { paragraph: { elements: [{ textRun: { content: "Tab 1 content" } }] } },
            ],
          },
        },
        childTabs: [
          {
            tabProperties: { tabId: "tab1-child", title: "Child Tab", index: 0 },
            documentTab: {
              body: {
                content: [
                  { paragraph: { elements: [{ textRun: { content: "Child content" } }] } },
                ],
              },
            },
          },
        ],
      },
      {
        tabProperties: { tabId: "tab2", title: "Second Tab", index: 1 },
        documentTab: {
          body: {
            content: [
              { paragraph: { elements: [{ textRun: { content: "Tab 2 content" } }] } },
            ],
          },
        },
      },
    ],
  };

  describe("getDocumentWithTabs", () => {
    it("should return tabs information", async () => {
      mockDocsGet.mockResolvedValue({ data: mockTabsResponse });

      const result = await service.getDocumentWithTabs("doc1");

      expect(result.tabs).toHaveLength(2);
      expect(result.tabs![0].tabId).toBe("tab1");
      expect(result.tabs![0].title).toBe("First Tab");
      expect(result.tabs![0].childTabs).toHaveLength(1);
      expect(result.hasMultipleTabs).toBe(true);
    });

    it("should read first tab by default", async () => {
      mockDocsGet.mockResolvedValue({ data: mockTabsResponse });

      const result = await service.getDocumentWithTabs("doc1");

      expect(result.body).toBe("Tab 1 content");
      expect(result.activeTabId).toBe("tab1");
    });

    it("should read specific tab by ID", async () => {
      mockDocsGet.mockResolvedValue({ data: mockTabsResponse });

      const result = await service.getDocumentWithTabs("doc1", "tab2");

      expect(result.body).toBe("Tab 2 content");
      expect(result.activeTabId).toBe("tab2");
    });

    it("should read nested child tab", async () => {
      mockDocsGet.mockResolvedValue({ data: mockTabsResponse });

      const result = await service.getDocumentWithTabs("doc1", "tab1-child");

      expect(result.body).toBe("Child content");
      expect(result.activeTabId).toBe("tab1-child");
    });

    it("should throw error for invalid tab ID", async () => {
      mockDocsGet.mockResolvedValue({ data: mockTabsResponse });

      await expect(service.getDocumentWithTabs("doc1", "invalid")).rejects.toThrow(
        'Tab with ID "invalid" not found in document'
      );
    });

    it("should handle single-tab document", async () => {
      const singleTabResponse = {
        documentId: "doc1",
        title: "Single Tab",
        tabs: [
          {
            tabProperties: { tabId: "only-tab", title: "Main", index: 0 },
            documentTab: {
              body: { content: [{ paragraph: { elements: [{ textRun: { content: "Content" } }] } }] },
            },
          },
        ],
      };
      mockDocsGet.mockResolvedValue({ data: singleTabResponse });

      const result = await service.getDocumentWithTabs("doc1");

      expect(result.hasMultipleTabs).toBe(false);
      expect(result.tabs).toHaveLength(1);
    });
  });

  describe("getDocumentTabs", () => {
    it("should list all tabs with hierarchy", async () => {
      mockDocsGet.mockResolvedValue({ data: mockTabsResponse });

      const tabs = await service.getDocumentTabs("doc1");

      expect(tabs).toHaveLength(2);
      expect(tabs[0].tabId).toBe("tab1");
      expect(tabs[0].title).toBe("First Tab");
      expect(tabs[0].childTabs).toHaveLength(1);
      expect(tabs[0].childTabs![0].tabId).toBe("tab1-child");
      expect(tabs[1].tabId).toBe("tab2");
    });

    it("should return empty array for document without tabs", async () => {
      mockDocsGet.mockResolvedValue({
        data: { documentId: "doc1", title: "No Tabs", tabs: undefined },
      });

      const tabs = await service.getDocumentTabs("doc1");

      expect(tabs).toHaveLength(0);
    });
  });

  describe("getTabContent", () => {
    it("should return tab content with metadata", async () => {
      mockDocsGet.mockResolvedValue({ data: mockTabsResponse });

      const content = await service.getTabContent("doc1", "tab1");

      expect(content.tabId).toBe("tab1");
      expect(content.title).toBe("First Tab");
      expect(content.index).toBe(0);
      expect(content.body).toBe("Tab 1 content");
      expect(content.parentTabId).toBeUndefined();
    });

    it("should find nested child tabs with parentTabId", async () => {
      mockDocsGet.mockResolvedValue({ data: mockTabsResponse });

      const content = await service.getTabContent("doc1", "tab1-child");

      expect(content.tabId).toBe("tab1-child");
      expect(content.title).toBe("Child Tab");
      expect(content.body).toBe("Child content");
      expect(content.parentTabId).toBe("tab1");
    });

    it("should throw error for invalid tab ID", async () => {
      mockDocsGet.mockResolvedValue({ data: mockTabsResponse });

      await expect(service.getTabContent("doc1", "nonexistent")).rejects.toThrow(
        'Tab with ID "nonexistent" not found in document'
      );
    });
  });

  describe("insertText with tabs", () => {
    it("should insert text with tabId", async () => {
      mockDocsBatchUpdate.mockResolvedValue({ data: {} });

      await service.insertText("doc1", "New text", 10, "tab2");

      expect(mockDocsBatchUpdate).toHaveBeenCalledWith({
        documentId: "doc1",
        requestBody: {
          requests: [{ insertText: { location: { index: 10, tabId: "tab2" }, text: "New text" } }],
        },
      });
    });

    it("should insert text without tabId for backward compatibility", async () => {
      mockDocsBatchUpdate.mockResolvedValue({ data: {} });

      await service.insertText("doc1", "New text", 10);

      expect(mockDocsBatchUpdate).toHaveBeenCalledWith({
        documentId: "doc1",
        requestBody: {
          requests: [{ insertText: { location: { index: 10, tabId: undefined }, text: "New text" } }],
        },
      });
    });
  });

  describe("appendText with tabs", () => {
    it("should append text to specific tab", async () => {
      mockDocsGet.mockResolvedValue({ data: mockTabsResponse });
      mockDocsBatchUpdate.mockResolvedValue({ data: {} });

      await service.appendText("doc1", "Appended text", "tab2");

      // Should look up content in tab2 and find the end index
      expect(mockDocsBatchUpdate).toHaveBeenCalled();
      const batchUpdateCall = mockDocsBatchUpdate.mock.calls[0][0];
      expect(batchUpdateCall.requestBody.requests[0].insertText.location.tabId).toBe("tab2");
    });

    it("should throw error for invalid tab ID", async () => {
      mockDocsGet.mockResolvedValue({ data: mockTabsResponse });

      await expect(service.appendText("doc1", "Text", "invalid-tab")).rejects.toThrow(
        'Tab with ID "invalid-tab" not found'
      );
    });
  });

  describe("replaceAllText with tabs", () => {
    it("should replace text in specific tab", async () => {
      mockDocsBatchUpdate.mockResolvedValue({
        data: { replies: [{ replaceAllText: { occurrencesChanged: 2 } }] },
      });

      const count = await service.replaceAllText("doc1", "old", "new", true, "tab1");

      expect(count).toBe(2);
      expect(mockDocsBatchUpdate).toHaveBeenCalledWith({
        documentId: "doc1",
        requestBody: {
          requests: [{
            replaceAllText: {
              containsText: { text: "old", matchCase: true },
              replaceText: "new",
              tabsCriteria: { tabIds: ["tab1"] },
            },
          }],
        },
      });
    });

    it("should replace text in all tabs when no tabId specified", async () => {
      mockDocsBatchUpdate.mockResolvedValue({
        data: { replies: [{ replaceAllText: { occurrencesChanged: 5 } }] },
      });

      const count = await service.replaceAllText("doc1", "old", "new");

      expect(count).toBe(5);
      const batchCall = mockDocsBatchUpdate.mock.calls[0][0];
      expect(batchCall.requestBody.requests[0].replaceAllText.tabsCriteria).toBeUndefined();
    });
  });
});
