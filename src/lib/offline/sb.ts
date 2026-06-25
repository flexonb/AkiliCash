import { api } from "@/lib/api";

export const isOffline = false; 

export const loadTableOffline = async <T>(table: string, columns: string = "*", companyId?: string): Promise<T[]> => {
  let query = api.from(table).select(columns);
  if (companyId) {
    query = query.eq("company_id", companyId);
  }
  const { data, error } = await query;
  if (error) {
    console.error(`Error loading table ${table}:`, error);
    return [];
  }
  return data || [];
};

export const syncOutbox = async () => {}; 
export const sbInsert = async (table: string, payload: any) => {
  return await api.from(table).insert(payload);
};