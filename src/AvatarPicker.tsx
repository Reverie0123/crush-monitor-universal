import { useRef, useState } from "react";
import { say, useT, type Text } from "./i18n";

const SIZE = 128;

/** Center-crops an image file to a small square JPEG data URL. */
async function toAvatar(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext("2d")!;
    // Transparent PNGs would turn black as JPEG.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      SIZE,
      SIZE,
    );
    return canvas.toDataURL("image/jpeg", 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function Avatar({
  src,
  name,
  mine,
  className = "avatar",
}: {
  src?: string;
  name: string;
  mine?: boolean;
  className?: string;
}) {
  return (
    <div className={`${className} ${mine ? "mine" : ""}`}>
      {src ? <img src={src} alt="" /> : name.slice(0, 1)}
    </div>
  );
}

export function AvatarPicker({
  label,
  name,
  src,
  mine,
  onChange,
}: {
  label: string;
  name: string;
  src?: string;
  mine?: boolean;
  onChange: (src: string | undefined) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setErrorState] = useState<Text>("");
  const setError = (x: Text) => setErrorState(() => x);
  const t = useT();
  return (
    <div className="avatar-picker">
      <button
        className="avatar-picker-button"
        onClick={() => input.current?.click()}
        aria-label={t.avatar.change(label)}
        title={t.avatar.clickToChange}
      >
        <Avatar src={src} name={name} mine={mine} />
      </button>
      <div className="avatar-picker-text">
        <strong>{label}</strong>
        <div>
          <button
            className="text-button"
            onClick={() => input.current?.click()}
          >
            {src ? t.avatar.replace : t.avatar.upload}
          </button>
          {src && (
            <button className="text-button" onClick={() => onChange(undefined)}>
              {t.avatar.reset}
            </button>
          )}
        </div>
        {error && <span className="error">{say(t, error)}</span>}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            setError("");
            onChange(await toAvatar(file));
          } catch {
            setError((t) => t.avatar.unreadable);
          }
        }}
      />
    </div>
  );
}
