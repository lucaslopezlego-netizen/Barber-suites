"use client";

/* eslint-disable @next/next/no-img-element */
import { Camera } from "lucide-react";
import { useActionState, useState } from "react";
import { saveBarber } from "@/app/admin/actions";
import { FormMessage, SubmitButton } from "@/components/admin/ui";
import { Avatar } from "@/components/ui/Avatar";

interface Props {
  barber: { id: string; name: string; bio: string | null; photo_url: string | null; active: boolean } | null;
  services: { id: string; name: string; active: boolean }[];
  selected: string[];
}

export function BarberForm({ barber, services, selected }: Props) {
  const [state, action] = useActionState(saveBarber, null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState(barber?.name ?? "");
  const [bio, setBio] = useState(barber?.bio ?? "");
  const [removePhoto, setRemovePhoto] = useState(false);
  const isNew = !barber;

  return (
    <form action={action} className="card max-w-xl space-y-6 p-5 sm:p-6">
      {barber && <input type="hidden" name="id" value={barber.id} />}

      <div className="flex items-center gap-5">
        {preview ? (
          <img src={preview} alt="Vista previa" className="size-24 rounded-full object-cover ring-1 ring-gold/40" />
        ) : (
          <Avatar name={name || "BS"} src={removePhoto ? null : barber?.photo_url} size={96} />
        )}
        <div className="space-y-2">
          <label className="btn-ghost cursor-pointer !px-4 !py-2.5 text-sm">
            <Camera className="size-4" /> {barber?.photo_url || preview ? "Cambiar foto" : "Subir foto"}
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setPreview(f ? URL.createObjectURL(f) : null);
                setRemovePhoto(false);
              }}
            />
          </label>
          <p className="text-xs text-subtle">JPG, PNG o WebP · máx. 5 MB · mejor cuadrada</p>
          {barber?.photo_url && !preview && (
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" name="remove_photo" checked={removePhoto} onChange={(e) => setRemovePhoto(e.target.checked)} /> Quitar foto
            </label>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="name" className="label">
          Nombre
        </label>
        <input id="name" name="name" required minLength={2} maxLength={60} className="field" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label htmlFor="bio" className="label">
          Descripción corta <span className="font-normal text-subtle">(se ve en la web)</span>
        </label>
        <textarea id="bio" name="bio" maxLength={280} className="field min-h-24" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Ej.: Especialista en degradados y diseños." />
        <p className="mt-1 text-right text-xs text-subtle">{bio.length}/280</p>
      </div>

      <fieldset>
        <legend className="label">Servicios que hace</legend>
        {services.length === 0 ? (
          <p className="text-sm text-subtle">Todavía no hay servicios creados.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((s) => (
              <label key={s.id} className="flex items-center gap-3 rounded-xl border border-line-strong px-4 py-3 text-sm has-[:checked]:border-gold/60 has-[:checked]:bg-gold/10">
                <input type="checkbox" name="service_ids" value={s.id} defaultChecked={isNew || selected.includes(s.id)} className="size-5 accent-[var(--color-gold)]" />
                {s.name}
                {!s.active && <span className="text-xs text-subtle">(inactivo)</span>}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="active" defaultChecked={barber?.active ?? true} className="size-5 accent-[var(--color-gold)]" />
        Activo (aparece en la web y recibe reservas)
      </label>

      <FormMessage state={state} />
      <SubmitButton>{isNew ? "Crear barbero" : "Guardar cambios"}</SubmitButton>
      {isNew && <p className="text-xs text-subtle">Después de crearlo, configura su horario en la sección Horarios.</p>}
    </form>
  );
}
