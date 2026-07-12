import type { CropId } from '../engine/types';
import { getCropSpriteUrl, type SpriteStage } from './cropSprites';

interface CropSpriteProps {
  cropId: CropId;
  stage: SpriteStage;
  /** Emoji rendered when the sprite asset for this crop+stage isn't present. */
  fallback: string;
  /** Rendered pixel height of the sprite; width follows the art's aspect ratio. */
  size: number;
  /** Tailwind classes applied to the emoji fallback (e.g. text sizing). */
  fallbackClass?: string;
  /** Decorative by default (empty alt); pass a label to announce it. */
  label?: string;
}

/**
 * Renders a pixel-art crop sprite, falling back to an emoji when the asset is
 * missing. `image-rendering: pixelated` keeps the art crisp when scaled.
 */
export function CropSprite({ cropId, stage, fallback, size, fallbackClass, label }: CropSpriteProps) {
  const url = getCropSpriteUrl(cropId, stage);

  if (!url) {
    return (
      <span className={fallbackClass} aria-hidden={label ? undefined : true}>
        {fallback}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={label ?? ''}
      height={size}
      draggable={false}
      style={{ height: size, width: 'auto', imageRendering: 'pixelated' }}
    />
  );
}
