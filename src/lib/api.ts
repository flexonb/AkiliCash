import { db, auth as fbAuth, storage as fbStorage, functions as fbFunctions } from "@/lib/firebase";
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit as fLimit, writeBatch } from "firebase/firestore";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut as fbSignOut, onAuthStateChanged, User } from "firebase/auth";
import { ref, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";

class ApiQueryBuilder {
  table: string;
  _select = "*";
  _eq: Record<string, any> = {};
  _in: Record<string, any[]> = {};
  _is: Record<string, any> = {};
  _order: { col: string; asc: boolean }[] = [];
  _limit?: number;
  _single = false;
  _maybeSingle = false;

  _isUpdate = false;
  _isDelete = false;
  _patch: any;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = "*") { this._select = columns; return this; }
  eq(col: string, val: any) { this._eq[col] = val; return this; }
  in(col: string, vals: any[]) { this._in[col] = vals; return this; }
  is(col: string, val: any) { this._is[col] = val; return this; }
  order(col: string, { ascending = true } = {}) { this._order.push({ col, asc: ascending }); return this; }
  limit(n: number) { this._limit = n; return this; }
  single() { this._single = true; return this; }
  maybeSingle() { this._maybeSingle = true; return this; }

  async then(resolve: any, reject: any) {
    try {
      if (this._isUpdate) {
        if (this._eq.id !== undefined) {
           await updateDoc(doc(db, this.table, String(this._eq.id)), this._patch);
           const res = { id: this._eq.id, ...this._patch };
           return resolve({ data: this._single ? res : [res], error: null });
        }
        return resolve({ data: this._single ? null : [], error: null });
      }
      if (this._isDelete) {
        if (this._eq.id !== undefined) {
           await deleteDoc(doc(db, this.table, String(this._eq.id)));
        }
        return resolve({ data: null, error: null });
      }

      if (this._eq.id !== undefined && Object.keys(this._eq).length === 1 && Object.keys(this._in).length === 0 && Object.keys(this._is).length === 0) {
        const d = await getDoc(doc(db, this.table, String(this._eq.id)));
        if (!d.exists()) {
          return resolve({ data: this._maybeSingle ? null : (this._single ? null : []), error: null });
        }
        const data = { id: d.id, ...d.data() };
        return resolve({ data: this._maybeSingle ? data : (this._single ? data : [data]), error: null });
      }

      const q: any = collection(db, this.table);
      const conditions: any[] = [];
      for (const [col, val] of Object.entries(this._eq)) {
        conditions.push(where(col, "==", val));
      }
      for (const [col, vals] of Object.entries(this._in)) {
        if (vals && vals.length > 0) {
          conditions.push(where(col, "in", vals.slice(0, 30)));
        } else if (vals && vals.length === 0) {
          return resolve({ data: this._maybeSingle ? null : (this._single ? null : []), error: null });
        }
      }
      for (const [col, val] of Object.entries(this._is)) {
        conditions.push(where(col, "==", val));
      }
      for (const ord of this._order) {
        conditions.push(orderBy(ord.col, ord.asc ? "asc" : "desc"));
      }
      if (this._limit) conditions.push(fLimit(this._limit));
      
      let docs;
      if (conditions.length > 0) {
        docs = await getDocs(query(q, ...conditions));
      } else {
        docs = await getDocs(q);
      }
      
      const results = docs.docs.map(d => ({ id: d.id, ...d.data() }));

      // Handle specific relational joins
      if (this._select.includes('clients(')) {
         for (const r of results) {
            if (r.client_id) {
               const cDoc = await getDoc(doc(db, "clients", String(r.client_id)));
               if (cDoc.exists()) (r as any).clients = { id: cDoc.id, ...cDoc.data() };
            }
         }
      }

      if (this._single) {
        if (results.length === 0) throw new Error("Row not found");
        return resolve({ data: results[0], error: null });
      }
      if (this._maybeSingle) {
        return resolve({ data: results.length ? results[0] : null, error: null });
      }
      return resolve({ data: results, error: null });

    } catch (e) {
      return resolve({ data: null, error: e });
    }
  }

  insert(payload: any) {
    const execute = async () => {
      try {
        if (Array.isArray(payload)) {
          return { data: null, error: new Error("Array insert not supported in shim") };
        }
        const id = payload.id || crypto.randomUUID();
        const payloadWithDefaults = {
          created_at: new Date().toISOString(),
          ...payload
        };
        await setDoc(doc(db, this.table, String(id)), payloadWithDefaults);
        const data = { id, ...payloadWithDefaults };
        if (this._select === "id") return { data: this._single ? data : [data], error: null };
        return { data: this._single ? data : [data], error: null };
      } catch(e) { return { data: null, error: e }; }
    };
    return {
      select: (cols: string) => { this._select = cols; return this.insert(payload); },
      single: () => { this._single = true; return this.insert(payload); },
      then: (resolve: any, reject: any) => execute().then(resolve, reject),
    };
  }

  update(patch: any) {
    const builder = new ApiQueryBuilder(this.table);
    builder._isUpdate = true;
    builder._patch = patch;
    
    // Provide a simple chainable object that eventually resolves
    const chainable = {
      eq: (col: string, val: any) => { builder.eq(col, val); return chainable; },
      is: (col: string, val: any) => { builder.is(col, val); return chainable; },
      select: (cols: string) => { builder.select(cols); return chainable; },
      single: () => { builder.single(); return chainable; },
      then: (resolve: any, reject: any) => builder.then(resolve, reject),
    };
    return chainable;
  }

  delete() {
    const builder = new ApiQueryBuilder(this.table);
    builder._isDelete = true;
    
    const chainable = {
      eq: (col: string, val: any) => { builder.eq(col, val); return chainable; },
      is: (col: string, val: any) => { builder.is(col, val); return chainable; },
      select: (cols: string) => { builder.select(cols); return chainable; },
      single: () => { builder.single(); return chainable; },
      then: (resolve: any, reject: any) => builder.then(resolve, reject),
    };
    return chainable;
  }
}

export const api = {
  auth: {
    getUser: async () => {
      await new Promise(r => setTimeout(r, 100)); // wait for auth init
      return { data: { user: fbAuth.currentUser }, error: null };
    },
    signUp: async ({ email, password }: any) => {
      try {
        const { createUserWithEmailAndPassword } = await import("firebase/auth");
        const cred = await createUserWithEmailAndPassword(fbAuth, email, password);
        return { data: { user: cred.user }, error: null };
      } catch (e) { return { data: null, error: e }; }
    },
    signInWithPassword: async ({ email, password }: any) => {
      try {
        const cred = await signInWithEmailAndPassword(fbAuth, email, password);
        return { data: { user: cred.user }, error: null };
      } catch (e) { return { data: null, error: e }; }
    },
    signInWithGoogle: async () => {
      try {
        const provider = new GoogleAuthProvider();
        const cred = await signInWithPopup(fbAuth, provider);
        return { data: { user: cred.user }, error: null };
      } catch (e) { return { data: null, error: e }; }
    },
    signOut: async () => {
      await fbSignOut(fbAuth);
      return { error: null };
    },
    onAuthStateChange: (cb: any) => {
      const unsub = onAuthStateChanged(fbAuth, (user) => {
        cb(user ? "SIGNED_IN" : "SIGNED_OUT", { user });
      });
      return { data: { subscription: { unsubscribe: unsub } } };
    }
  },
  from: (table: string) => {
    return new ApiQueryBuilder(table);
  },
  storage: {
    from: (bucket: string) => ({
      createSignedUrl: async (path: string, duration: number) => {
        try {
          const r = ref(fbStorage, `${bucket}/${path}`);
          const url = await getDownloadURL(r);
          return { data: { signedUrl: url }, error: null };
        } catch(e) { return { data: null, error: e }; }
      }
    })
  },
  functions: {
    invoke: async (name: string, { body }: any) => {
      try {
        const fn = httpsCallable(fbFunctions, name);
        const res = await fn(body);
        return { data: res.data, error: null };
      } catch (e) { return { data: null, error: e }; }
    }
  }
};
