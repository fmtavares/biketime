import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

type Props = {
  open: boolean;
  imageSrc: string | null;
  title?: string;
  /** Proporção do recorte (padrão 4:3, usado nas fotos de vendas). */
  aspect?: number;
  onOpenChange: (open: boolean) => void;
  /** Recebe o arquivo já recortado (JPEG). */
  onConfirm: (file: File) => void;
};

/**
 * Gera um File JPEG a partir da área recortada no canvas.
 */
async function getCroppedFile(
  imageSrc: string,
  crop: Area,
  fileName = "foto.jpg",
): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const width = Math.max(1, Math.round(crop.width));
  const height = Math.max(1, Math.round(crop.height));
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    width,
    height,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem"))),
      "image/jpeg",
      0.92,
    );
  });

  return new File([blob], fileName, { type: "image/jpeg" });
}

/** Carrega uma imagem a partir de URL/objectURL. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("Falha ao carregar imagem")));
    img.src = src;
  });
}

/**
 * Dialog para ajustar zoom e posição da foto antes do upload.
 */
export function ImageCropDialog({
  open,
  imageSrc,
  title = "Ajustar foto",
  aspect = 4 / 3,
  onOpenChange,
  onConfirm,
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setBusy(false);
    }
  }, [open, imageSrc]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setBusy(true);
    try {
      const file = await getCroppedFile(imageSrc, croppedAreaPixels);
      onConfirm(file);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="relative h-72 w-full overflow-hidden rounded-md bg-secondary">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              objectFit="contain"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Zoom</Label>
          <Slider
            min={1}
            max={3}
            step={0.05}
            value={[zoom]}
            onValueChange={(v) => setZoom(v[0] ?? 1)}
          />
          <p className="text-xs text-muted-foreground">
            Arraste a imagem para posicionar e use o zoom para enquadrar.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={busy || !croppedAreaPixels}>
            {busy ? "Processando…" : "Usar foto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
