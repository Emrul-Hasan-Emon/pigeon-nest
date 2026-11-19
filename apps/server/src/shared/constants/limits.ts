// Postgres `integer` upper bound — ids/quantities beyond this raise a DB error.
export const MAX_INT32 = 2147483647;

// numeric(12,2) upper bound used by SKU price columns.
export const MAX_DECIMAL_12_2 = 9999999999.99;
