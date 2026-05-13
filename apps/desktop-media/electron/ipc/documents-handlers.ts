import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../../src/shared/ipc";
import type { InvoiceReceiptDocumentsListRequest } from "../../src/shared/ipc";
import {
  countInvoiceReceiptDocuments,
  listInvoiceReceiptDocuments,
} from "../db/invoice-receipt-documents";

export function registerDocumentsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.countInvoiceReceiptDocuments, async (_event, libraryId?: string) => {
    return countInvoiceReceiptDocuments(typeof libraryId === "string" ? libraryId : undefined);
  });

  ipcMain.handle(
    IPC_CHANNELS.listInvoiceReceiptDocuments,
    async (_event, request: InvoiceReceiptDocumentsListRequest) => {
      return listInvoiceReceiptDocuments(request ?? {});
    },
  );
}
