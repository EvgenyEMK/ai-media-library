import { useEffect, useMemo, useState } from "react";
import type { DesktopPersonTagWithFaceCount } from "../../shared/ipc";
import { peoplePaginationTotalPages } from "../lib/people-pagination-total-pages";

export function useDesktopPeopleTagsPagination(
  rows: DesktopPersonTagWithFaceCount[],
  nameFilter: string,
  pageSize: number,
): {
  filteredRows: DesktopPersonTagWithFaceCount[];
  visibleRows: DesktopPersonTagWithFaceCount[];
  peopleListPage: number;
  setPeopleListPage: (page: number) => void;
} {
  const [peopleListPage, setPeopleListPage] = useState(0);

  const filteredRows = useMemo(() => {
    const q = nameFilter.trim().toLowerCase();
    if (!q) {
      return rows;
    }
    return rows.filter((row) => row.label.toLowerCase().includes(q));
  }, [rows, nameFilter]);

  useEffect(() => {
    setPeopleListPage(0);
  }, [nameFilter]);

  const visibleRows = useMemo(() => {
    const start = peopleListPage * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, peopleListPage, pageSize]);

  useEffect(() => {
    const totalPages = peoplePaginationTotalPages(filteredRows.length, pageSize);
    const maxPage = Math.max(0, totalPages - 1);
    if (peopleListPage > maxPage) {
      setPeopleListPage(maxPage);
    }
  }, [filteredRows.length, peopleListPage, pageSize]);

  return { filteredRows, visibleRows, peopleListPage, setPeopleListPage };
}
