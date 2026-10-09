import type { SVGProps } from "react";
import { glyphIcons, imageIcons } from "./figma-icons.generated";

type GlyphName = keyof typeof glyphIcons;
type ImageName = keyof typeof imageIcons;
type IconName = GlyphName | ImageName;

type IconProps = Omit<SVGProps<SVGSVGElement>, "name" | "ref"> & {
  name: IconName;
  // Icons are decorative unless a label is given; status icons must pass one (no colour-only meaning).
  label?: string;
};

const iconNames = [...Object.keys(glyphIcons), ...Object.keys(imageIcons)] as IconName[];

const isImageName = (name: IconName): name is ImageName => name in imageIcons;

// Next resolves static SVG imports to { src }, Vite/Vitest to a plain URL string.
const toUrl = (asset: string | { src: string }) => (typeof asset === "string" ? asset : asset.src);

const Icon = ({ name, label, className, ...rest }: IconProps) => {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  if (isImageName(name)) {
    const size = Number(/-(\d+)$/.exec(name)?.[1] ?? 22);
    return (
      // Static illustrative asset; next/image adds nothing for a 22px SVG tile.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={toUrl(imageIcons[name])}
        width={size}
        height={size}
        alt={label ?? ""}
        className={className}
        data-icon={name}
        aria-hidden={label ? undefined : true}
      />
    );
  }
  const Glyph = glyphIcons[name];
  return <Glyph className={className} data-icon={name} focusable="false" {...a11y} {...rest} />;
};

export { Icon, iconNames };
export type { IconName, IconProps };
