export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;        // página actual (0-indexed)
  first: boolean;
  last: boolean;
  empty: boolean;
}
