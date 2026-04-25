'use strict';
/**
 * supabaseStorage.js — Subida de fotos a Supabase Storage
 *
 * Vars requeridas en .env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_BUCKET_PARTES        (default: "partes-fotos")
 *   SUPABASE_BUCKET_INCIDENCIAS   (default: "incidencias-fotos")
 */
const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Comprime un buffer de imagen con sharp si el contentType es image/*.
 * Si no es imagen (ej: video), devuelve el buffer original sin tocar.
 *
 * @param {Buffer} buffer
 * @param {string} contentType
 * @param {{ maxSide: number, quality: number }} opciones
 * @returns {Promise<{ buffer: Buffer, contentType: string }>}
 */
async function _comprimirImagen(buffer, contentType, { maxSide, quality }) {
    if (!contentType || !contentType.startsWith('image/')) {
        // No es imagen — devolver tal cual
        return { buffer, contentType };
    }
    try {
        const comprimido = await sharp(buffer)
            .rotate()                          // respeta orientación EXIF
            .resize(maxSide, maxSide, {
                fit: 'inside',                 // no amplía, solo reduce
                withoutEnlargement: true,
            })
            .jpeg({ quality })
            .toBuffer();
        return { buffer: comprimido, contentType: 'image/jpeg' };
    } catch (e) {
        // Si sharp falla (formato raro, corrupto…), subir original
        console.warn('[supabaseStorage] compresión fallida, subiendo original:', e.message);
        return { buffer, contentType };
    }
}

/**
 * Si la imagen fue convertida a JPEG, normaliza el path para que
 * termine en .jpg, evitando archivos con extensión incorrecta.
 */
function _normalizarPathJpeg(path, contentType) {
    if (contentType !== 'image/jpeg') return path;
    if (/\.jpe?g$/i.test(path)) return path;
    if (/\.[^.]+$/.test(path)) return path.replace(/\.[^.]+$/, '.jpg');
    return `${path}.jpg`;
}

/**
 * Sube una foto de parte al bucket de partes.
 * Comprime automáticamente si es imagen (máx 1600 px, calidad 80).
 * @returns {Promise<string>} path interno guardado en Storage
 */
async function uploadPartPhoto(buffer, path, contentType = 'image/jpeg') {
    const { buffer: buf, contentType: ct } = await _comprimirImagen(buffer, contentType, {
        maxSide: 1600,
        quality: 80,
    });
    const finalPath = _normalizarPathJpeg(path, ct);
    const bucket = process.env.SUPABASE_BUCKET_PARTES || 'partes-fotos';
    const { error } = await supabase.storage
        .from(bucket)
        .upload(finalPath, buf, { contentType: ct, upsert: false });
    if (error) {
        console.error('[supabaseStorage] Error subiendo foto de parte:', error.message);
        throw error;
    }
    return finalPath;
}

/**
 * Sube una foto de incidencia al bucket de incidencias.
 * Comprime automáticamente si es imagen (máx 1800 px, calidad 82).
 * @returns {Promise<string>} path interno guardado en Storage
 */
async function uploadIncidenciaPhoto(buffer, path, contentType = 'image/jpeg') {
    const { buffer: buf, contentType: ct } = await _comprimirImagen(buffer, contentType, {
        maxSide: 1800,
        quality: 82,
    });
    const finalPath = _normalizarPathJpeg(path, ct);
    const bucket = process.env.SUPABASE_BUCKET_INCIDENCIAS || 'incidencias-fotos';
    const { error } = await supabase.storage
        .from(bucket)
        .upload(finalPath, buf, { contentType: ct, upsert: false });
    if (error) {
        console.error('[supabaseStorage] Error subiendo foto de incidencia:', error.message);
        throw error;
    }
    return finalPath;
}

/**
 * Genera una signed URL temporal para un path en el bucket de incidencias.
 * @param {string} path
 * @param {number} expirySeconds — default 7 días
 * @returns {Promise<string|null>} signed URL o null si falla
 */
async function getIncidenciaSignedUrl(path, expirySeconds = 60 * 60 * 24 * 7) {
    const bucket = process.env.SUPABASE_BUCKET_INCIDENCIAS || 'incidencias-fotos';
    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, expirySeconds);
        if (error || !data?.signedUrl) {
            console.warn('[supabaseStorage] signed URL incidencia fallida:', error?.message);
            return null;
        }
        return data.signedUrl;
    } catch (e) {
        console.warn('[supabaseStorage] excepción signed URL incidencia:', e.message);
        return null;
    }
}

module.exports = { uploadPartPhoto, uploadIncidenciaPhoto, getIncidenciaSignedUrl };
