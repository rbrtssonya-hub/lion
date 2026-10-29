import type { ImgHTMLAttributes } from 'react'
import { media } from '../../../config/media.js'

export function SafeImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  return <img {...props} onError={event => {
    const image = event.currentTarget
    if (image.getAttribute('src') !== media.depthFallback) {
      image.src = media.depthFallback
    }
  }} />
}
