import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#02183d",
          color: "#d97f5c",
          fontSize: 20,
          fontWeight: 600,
          borderRadius: "50%",
        }}
      >
        S
      </div>
    ),
    size,
  );
}
