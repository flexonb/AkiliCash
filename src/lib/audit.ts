import { api } from "./api";

export const logAudit = async (data: any) => {
  try {
    const { data: { user } } = await api.auth.getUser();
    if (!user) return;
    const { data: profile } = await api.from("profiles").select("company_id").eq("id", user.uid).maybeSingle();
    await api.from("audit_log").insert({
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      action: data.action,
      note: data.note || null,
      before_state: data.before || null,
      after_state: data.after || null,
      actor_id: user.uid,
      company_id: profile?.company_id,
    });
  } catch (e) {
    console.error("Failed to log audit", e);
  }
};