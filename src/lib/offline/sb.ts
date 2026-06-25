import { api } from "@/lib/api";

export const isOffline = false; 

export const loadTableOffline = async <T>(table: string, columns: string = "*"): Promise<T[]> => {
  const { data, error } = await api.from(table).select(columns);
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