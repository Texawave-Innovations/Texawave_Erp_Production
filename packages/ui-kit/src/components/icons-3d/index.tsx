import type { FC } from "react";
import type { Semantic3DIconProps } from "./types";
import { ICON_3D_REGISTRY, resolve3DSize } from "./registry";
import { Icon3dDashboard } from "./icons";

export * from "./types";
export * from "./icons";
export * from "./registry";

/**
 * Universal Semantic 3D Icon Component for TexaOne ERP.
 * Renders high-fidelity, resolution-independent dimensional vector graphics
 * calibrated to the TexaOne palette and hierarchy tokens.
 */
export const Semantic3DIcon: FC<Semantic3DIconProps> = ({
  name,
  size = "md",
  className = "",
  alt,
  ...rest
}) => {
  const pixelSize = resolve3DSize(size);
  const IconComponent = ICON_3D_REGISTRY[name] ?? Icon3dDashboard;

  return (
    <IconComponent
      size={pixelSize}
      className={`inline-block shrink-0 transition-transform duration-200 select-none ${className}`}
      role={alt ? "img" : "presentation"}
      aria-label={alt}
      aria-hidden={!alt}
      {...rest}
    />
  );
};
