# STEX (Stream Texture) File Format – **Uncompressed variant**

This document describes the binary layout of a `.stex` file produced by Godot Engine when the importer is invoked with `COMPRESS_UNCOMPRESSED`. The description is derived from the Godot 3.6 source (`resource_importer_texture.cpp`, function `ResourceImporterTexture::_save_stex`, lines 221‑380; see line 234 for the uncompressed path).

Byte order: **little‑endian** for all integer fields.

| Offset | Size | Field | Description |
| ------ | ---- | ----- | ----------- |
| `0x00` | 4 × u8 | **Magic** | ASCII `"GDST"` – _GodoT STream_ |
| `0x04` | u16 | Width A | Original texture width.<br>(If VRAM/PO2 mode were used this would hold the power‑of‑two width, but for uncompressed textures it is simply the real width.) |
| `0x06` | u16 | Width B | Always **0** in the uncompressed path (would hold the original width in the VRAM/PO2 branch). |
| `0x08` | u16 | Height A | Original height. |
| `0x0A` | u16 | Height B | Always **0** for uncompressed textures. |
| `0x0C` | u32 | **Texture Flags** | Bit‑mask of Godot `Texture::Flags` (Repeat, Filter, Anisotropic, SRGB‑to‑Linear etc.). |
| `0x10` | u32 | **Format** | Low 8 bits = `Image::Format` enum (pixel layout).<br>High bits = feature flags:<br>• `0×00010000` — _HAS_MIPMAPS_<br>• `0×00020000` — _STREAM_ (streamable)<br>• `0×00040000` — _DETECT_3D_<br>• `0×00080000` — _DETECT_SRGB_<br>• `0×00100000` — _DETECT_NORMAL_<br>Flags reserved for WebP/PNG/VRAM compression are **never set** for uncompressed textures. |
| `0x14` | … | **Pixel Data** | Raw image bytes in the declared `Image::Format`. If the _HAS_MIPMAPS_ bit is present, all mip levels are concatenated biggest‑to‑smallest. No per‑level headers or length fields; the reader calculates sizes from the geometry.<br>The stream runs to end‑of‑file. |

## `Image::Format` quick reference (low‑byte of *Format* field)

| Value | Name | Bpp | Layout |
| ----- | ---- | --- | ------ |
| 0 | `FORMAT_L8` | 8 | Unsigned luminance |
| 1 | `FORMAT_LA8` | 16 | Luminance, Alpha |
| 2 | `FORMAT_R8` | 8 | Red |
| 3 | `FORMAT_RG8` | 16 | Red, Green |
| 4 | `FORMAT_RGB8` | 24 | Red, Green, Blue |
| 5 | `FORMAT_RGBA8` | 32 | RGBA |
| 6 | `FORMAT_RGB565` | 16 | BGR 5‑6‑5 |
| … | _etc._ | | |

(The complete list is in `core/image.h`.)

## Mipmap packing

When _HAS_MIPMAPS_ is set the importer first generates the full mip chain, then writes all levels back‑to‑back:

```
level_size(n) = max(1, width  >> n) *
                max(1, height >> n) *
                bytes_per_pixel
```

Levels are written from `n = 0` (full resolution) until both dimensions reach 1.

## Example

Uncompressed 256 × 128 **RGBA8** texture, no mipmaps, no flags:

```
Offset  Bytes (little‑endian)       Comment
------  --------------------------  -------------------------------
00      47 44 53 54                 'GDST'
04      00 01                       width = 256
06      00 00                       widthB = 0
08      80 00                       height = 128
0A      00 00                       heightB = 0
0C      00 00 00 00                 texture flags = 0
10      05 00 00 00                 format = RGBA8 (5)
14      ... 131 072 bytes ...       raw RGBA pixels (256×128×4)
```

With mipmaps the _HAS_MIPMAPS_ bit (`0×00010000`) would be OR‑ed into *Format* and the pixel data section would append 65 536 B, 16 384 B, … down to 8 B for a total of ≈ 174 kB.

---

*Prepared 2025-07-29.*

## Appendix: Field Value Analysis

*Based on analysis of extracted STEX files from Godot APK builds.*

### Texture Flags Field Values

The **Texture Flags** field at offset 0x0C can contain various combinations of Godot `Texture::Flags`:

| Flag Value | Name | Description |
|------------|------|-------------|
| `0x01` | FLAG_MIPMAPS | Texture has mipmaps |
| `0x02` | FLAG_REPEAT | Texture repeats/wraps |
| `0x04` | FLAG_FILTER | Texture filtering enabled |
| `0x08` | FLAG_ANISOTROPIC_FILTER | Anisotropic filtering |
| `0x10` | FLAG_CONVERT_TO_LINEAR | Convert from sRGB to linear |
| `0x20` | FLAG_MIRRORED_REPEAT | Mirrored repeat mode |
| `0x40` | FLAG_VIDEO_SURFACE | Video surface texture |

*Example: A value of `0x04` indicates filtering is enabled.*

### Format Field Breakdown

The **Format** field at offset 0x10 combines the pixel format (low 8 bits) with feature flags (high 24 bits):

#### Image::Format Values (Low 8 Bits)
| Value | Format Name | Bytes/Pixel | Description |
|-------|-------------|-------------|-------------|
| `0x00` | FORMAT_L8 | 1 | 8-bit luminance |
| `0x01` | FORMAT_LA8 | 2 | 8-bit luminance + alpha |
| `0x02` | FORMAT_R8 | 1 | 8-bit red channel |
| `0x03` | FORMAT_RG8 | 2 | 8-bit red + green |
| `0x04` | FORMAT_RGB8 | 3 | 8-bit RGB |
| `0x05` | FORMAT_RGBA8 | 4 | 8-bit RGBA |
| `0x06` | FORMAT_RGB565 | 2 | 5-6-5 RGB |
| `0x07` | FORMAT_RGBA4444 | 2 | 4-4-4-4 RGBA |
| `0x08` | FORMAT_RGBA5551 | 2 | 5-5-5-1 RGBA |

#### Feature Flags (High 24 Bits)
| Flag Value | Name | Description |
|------------|------|-------------|
| `0x00010000` | HAS_MIPMAPS | Texture contains mipmap levels |
| `0x00020000` | STREAM | Streamable texture |
| `0x00040000` | DETECT_3D | Auto-detect 3D usage |
| `0x00080000` | DETECT_SRGB | Auto-detect sRGB usage |
| `0x00100000` | DETECT_NORMAL | Auto-detect normal map usage |

**Additional Undocumented Flags**: Analysis reveals additional high-bit flags (e.g., `0x1000000`, `0x2000000`, `0x4000000`) that are not documented in this specification. These may be:
- Version-specific flags
- Platform-specific flags  
- Export/build configuration flags

*Example: Format value `0x7000005` = FORMAT_RGBA8 (0x05) + undocumented flags (0x7000000)*

### Mipmap Size Calculation

When the `HAS_MIPMAPS` flag is set, mipmap levels are stored consecutively after the main texture data. Each level size is calculated as:

```
level_size(n) = max(1, width >> n) × max(1, height >> n) × bytes_per_pixel
```

**Total mipmap data size** for a WxH texture:
```
total_size = Σ(n=0 to log₂(max(W,H))) level_size(n)
```

*Example: 1024×1024 RGBA8 with mipmaps = 4,194,304 + 1,048,576 + 262,144 + ... ≈ 5.59MB total*

