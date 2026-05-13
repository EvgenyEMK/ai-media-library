import type { DesktopApi, InvoiceReceiptDocumentsListRequest } from "../../shared/ipc";

export function createDocumentActions(api: Pick<DesktopApi, "countInvoiceReceiptDocuments" | "listInvoiceReceiptDocuments">) {
  return {
    loadInvoiceReceiptCatalogCount(libraryId?: string): Promise<number> {
      return api.countInvoiceReceiptDocuments(libraryId);
    },
    loadInvoiceReceiptDocuments(request: InvoiceReceiptDocumentsListRequest) {
      return api.listInvoiceReceiptDocuments(request);
    },
  };
}
