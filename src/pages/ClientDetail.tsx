import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/AppCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Pencil, Trash2, Pause, Play } from "lucide-react";
import { useSettings, formatMoney } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { GuarantorForm } from "@/components/GuarantorForm";
import { LoanForm } from "@/components/LoanForm";
import { ClientForm } from "@/components/ClientForm";
import { toast } from "sonner";
import { CallButton } from "@/components/CallButton";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { profile, isAdmin } = useAuth();
  const [client, setClient] = useState<any>(null);
  const [guarantors, setGuarantors] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [idPhotoUrl, setIdPhotoUrl] = useState<string | null>(null);
  const [passportPhotoUrl, setPassportPhotoUrl] = useState<string | null>(null);
  const [openGuarantor, setOpenGuarantor] = useState(false);
  const [openLoan, setOpenLoan] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);

  const load = async () => {
    if (!id || !profile?.company_id) return;
    const [{ data: c }, { data: g }, { data: l }] = await Promise.all([
      api.from("clients").select("*").eq("id", id).eq("company_id", profile.company_id).maybeSingle(),
      api.from("guarantors").select("*").eq("client_id", id).eq("company_id", profile.company_id),
      api.from("loans").select("*").eq("client_id", id).eq("company_id", profile.company_id),
    ]);
    setClient(c);
    setGuarantors(g ?? []);
    
    // Sort locally to handle missing created_at
    const sortedLoans = (l ?? []).sort((a: any, b: any) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });
    setLoans(sortedLoans);
    if (c?.id_photo_path) {
      const { data } = await api.storage.from("client-photos").createSignedUrl(c.id_photo_path, 3600);
      setIdPhotoUrl(data?.signedUrl ?? null);
    } else setIdPhotoUrl(null);
    if (c?.passport_photo_path) {
      const { data } = await api.storage.from("client-photos").createSignedUrl(c.passport_photo_path, 3600);
      setPassportPhotoUrl(data?.signedUrl ?? null);
    } else setPassportPhotoUrl(null);
  };

  useEffect(() => { load(); }, [id]);

  if (!client) return <p>Loading…</p>;

  const isDormant = client.status === "dormant";

  const toggleStatus = async () => {
    const next = isDormant ? "active" : "dormant";
    const { error } = await api.from("clients").update({ status: next }).eq("id", client.id);
    if (error) return toast.error(error.message);
    toast.success(next === "dormant" ? "Client marked dormant" : "Client reactivated");
    setConfirmStatus(false);
    load();
  };

  const deleteClient = async () => {
    // Best-effort cleanup of dependents
    await api.from("guarantors").delete().eq("client_id", client.id);
    const { error } = await api.from("clients").delete().eq("id", client.id);
    if (error) return toast.error(error.message);
    toast.success("Client deleted");
    navigate("/clients");
  };

  const hasBusiness = client.business_name || client.business_district || client.business_sub_county || client.business_village || client.business_nearby;
  const hasCollateral = client.land_owner_name || client.block_no || client.plot_no || client.volume || client.folio || client.vehicle_reg_no;
  const hasPhotos = idPhotoUrl || passportPhotoUrl;

  return (
    <div className="space-y-6">
      <Link to="/clients" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to clients
      </Link>

      <Card className={`p-6 ${isDormant ? "opacity-80" : ""}`}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{client.full_name}</h1>
              <Badge variant={isDormant ? "secondary" : "default"}>{isDormant ? "Dormant" : "Active"}</Badge>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-muted-foreground">
              <span>{client.phone}</span>
              <CallButton phone={client.phone} name={client.full_name} />
              {client.alt_phone && (
                <>
                  <span>·</span>
                  <span>{client.alt_phone}</span>
                  <CallButton phone={client.alt_phone} name={client.full_name} />
                </>
              )}
            </div>
            {client.address && <p className="text-sm">{client.address}</p>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => setOpenEdit(true)}>
              <Pencil className="w-4 h-4 mr-1" /> Edit
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmStatus(true)}>
              {isDormant ? <><Play className="w-4 h-4 mr-1" /> Reactivate</> : <><Pause className="w-4 h-4 mr-1" /> Mark dormant</>}
            </Button>
            {isAdmin && (
              <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            )}
          </div>
        </div>
      </Card>

      {hasPhotos && (
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">Photos</h2>
          <div className="flex gap-4 flex-wrap">
            {idPhotoUrl && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">ID</p>
                <a href={idPhotoUrl} target="_blank" rel="noreferrer">
                  <img src={idPhotoUrl} alt="ID" className="w-32 h-32 object-cover rounded-md border" />
                </a>
              </div>
            )}
            {passportPhotoUrl && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Passport</p>
                <a href={passportPhotoUrl} target="_blank" rel="noreferrer">
                  <img src={passportPhotoUrl} alt="Passport" className="w-32 h-32 object-cover rounded-md border" />
                </a>
              </div>
            )}
          </div>
        </Card>
      )}

      {hasBusiness && (
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">Business</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" value={client.business_name} />
            <Field label="District" value={client.business_district} />
            <Field label="Sub County" value={client.business_sub_county} />
            <Field label="Village" value={client.business_village} />
            <Field label="Nearby" value={client.business_nearby} />
          </div>
        </Card>
      )}

      {hasCollateral && (
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">Security / Collateral</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Land owner" value={client.land_owner_name} />
            <Field label="Block No" value={client.block_no} />
            <Field label="Plot No" value={client.plot_no} />
            <Field label="Volume" value={client.volume} />
            <Field label="Folio" value={client.folio} />
            <Field label="Vehicle Reg No" value={client.vehicle_reg_no} />
          </div>
        </Card>
      )}

      <section className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Guarantors</h2>
          <Button size="sm" variant="outline" onClick={() => setOpenGuarantor(true)}><Plus className="w-4 h-4 mr-1" /> Add</Button>
        </div>
        <div className="grid gap-2">
          {guarantors.map((g) => (
            <Card key={g.id} className="p-3">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{g.name}</p>
                  <p className="text-sm text-muted-foreground">{g.phone}{g.relationship ? ` · ${g.relationship}` : ""}{g.address ? ` · ${g.address}` : ""}</p>
                </div>
                <CallButton phone={g.phone} name={g.name} />
              </div>
            </Card>
          ))}
          {guarantors.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Loans</h2>
          <Button size="sm" onClick={() => setOpenLoan(true)}><Plus className="w-4 h-4 mr-1" /> New loan</Button>
        </div>
        <div className="grid gap-2">
          {loans.map((l) => (
            <Link key={l.id} to={`/loans/${l.id}`}>
              <Card className="p-3 hover:shadow-elegant transition-shadow">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{formatMoney(l.principal, settings)} <span className="text-muted-foreground font-normal">· {l.interest_rate}% · {l.duration_months}mo</span></p>
                    <p className="text-xs text-muted-foreground">Total repayable: {formatMoney(l.total_repayable, settings)}</p>
                  </div>
                  <Badge variant={l.status === "completed" ? "secondary" : l.status === "defaulted" ? "destructive" : "default"}>{l.status}</Badge>
                </div>
              </Card>
            </Link>
          ))}
          {loans.length === 0 && <p className="text-sm text-muted-foreground">No loans yet.</p>}
        </div>
      </section>

      <GuarantorForm open={openGuarantor} onOpenChange={setOpenGuarantor} clientId={client.id} onCreated={load} />
      <LoanForm open={openLoan} onOpenChange={setOpenLoan} clientId={client.id} onCreated={load} />
      <ClientForm
        open={openEdit}
        onOpenChange={setOpenEdit}
        onCreated={load}
        client={{ ...client, guarantors }}
      />

      <AlertDialog open={confirmStatus} onOpenChange={setConfirmStatus}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isDormant ? "Reactivate client?" : "Mark client dormant?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isDormant
                ? "This client will be marked active again."
                : "Dormant clients are kept on file but flagged as inactive."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={toggleStatus}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {client.full_name} and their guarantors. Loans and payments are kept for accounting. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteClient} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
