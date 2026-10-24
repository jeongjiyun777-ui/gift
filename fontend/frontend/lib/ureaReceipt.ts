export interface UreaReceiptResult {
  fields: {
    purchased_on: string | null;
    merchant_name: string | null;
    business_number: string | null;
    card_company: string | null;
    unit_price: string | null;
    liters: string | null;
  };
  warnings: string[];
}

export async function prepareReceiptImage(file: File) {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    throw new Error("영수증 사진을 선택해 주세요.");
  }
  if (file.size > 25 * 1024 * 1024) throw new Error("사진은 25MB 이하로 선택해 주세요.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("이 사진 형식을 읽을 수 없습니다. 카메라로 다시 촬영하거나 JPG 사진을 선택해 주세요."));
      image.src = url;
    });
    const scale = Math.min(1, 2200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("사진을 처리하지 못했습니다. 다시 선택해 주세요.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const imageBase64 = dataUrl.split(",")[1];
    if (!imageBase64 || imageBase64.length > 11200000) throw new Error("사진 크기가 큽니다. 영수증만 가까이 촬영해 주세요.");
    return { image_base64: imageBase64, mime_type: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}
