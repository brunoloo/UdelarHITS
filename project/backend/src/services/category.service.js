import { createCategory, findCategoryByTitulo, getCategories, getCategoryById, 
  getTopicsByCategoryId, deactivateCategoryById, activeCategoryById, getCategoriesByAuthorId, 
  updateCategoryById, getActiveCategories, getParticipantsByCategoryId, getEtiquetas, 
  hardDeleteCategoryById, categoryHasContent, getPopularCategories,
  getCategoryEditHistory } from '../repositories/category.repository.js';

import { cleanupInactiveTopics } from '../repositories/topic.repository.js';
import { isValidCategoryIcon } from '../config/categoryIcons.js';

const ETIQUETAS_VALIDAS = [
  'Facultades','Parciales y exámenes','Becas y trámites','Residencias','Pasantías',
  'Educación','Ciencia','Matemática','Ingeniería','Filosofía',
  'Historia','Psicología','Economía','Política','Derecho','Medicina',
  'Programación','Desarrollo web','Software','Ciberseguridad',
  'Inteligencia artificial','Gadgets','Gaming',
  'Arte','Diseño','Fotografía','Cine y TV','Música',
  'Escritura','Animación','Manualidades','Moda',
  'Vida diaria','Relaciones','Cocina','Salud y fitness',
  'Trabajo y carrera','Hogar','Mascotas','Hobbies',
  'Cultura','Viajes','Deportes','Naturaleza',
  'Medio ambiente','Noticias','Eventos',
  'Memes','Tutoriales','Preguntas','Historias',
  'Reseñas','Feedback','Autos y motos','Jardinería','Otro'
];

const createCategoryService = async (autorId, { titulo, descripcion, etiquetas }) => {
  if (!titulo?.trim()) {
    const err = new Error('El título es obligatorio');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (!descripcion?.trim()) {
    const err = new Error('La descripción es obligatoria');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (!etiquetas?.length) {
    const err = new Error('Debes seleccionar al menos una etiqueta');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const tituloNormalizado = titulo.trim().replace(/\s+/g, ' ');

  if (tituloNormalizado.length > 100) {
    const err = new Error('El título superó el máximo de caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (descripcion.trim().length > 500) {
    const err = new Error('La descripción superó el máximo de caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const etiquetasArray = Array.isArray(etiquetas) ? etiquetas : [etiquetas];

  const invalidas = etiquetasArray.filter(e => !ETIQUETAS_VALIDAS.includes(e));
  if (invalidas.length > 0) {
    const err = new Error(`Etiquetas inválidas: ${invalidas.join(', ')}`);
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const existing = await findCategoryByTitulo(tituloNormalizado);
  if (existing) {
    const err = new Error('Ya existe una categoría con ese título');
    err.code = 'TITULO_EXISTS';
    throw err;
  }

  return await createCategory({
    titulo: tituloNormalizado,
    descripcion: descripcion.trim(),
    autor_id: autorId,
    etiquetas: etiquetasArray
  });
};

const getCategoriesService = async () => {
  return await getCategories();
};

const getCategoryByIdService = async (id) => {
  if (!id) {
    const err = new Error('Falta el id');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  const category = await getCategoryById(id);
  if (!category) {
    const err = new Error('Categoría no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Ocultar metadatos de una categoría inactiva
  if (category.estado === 'inactiva') {
    category.titulo = null;
    category.descripcion = null;
    category.etiquetas = null;
    category.autor_id = null;
    category.autor_nickname = null;
    category.autor_url_imagen = null;
    category.contador_temas = null;
  }
  const topics = await getTopicsByCategoryId(id);
    return { ...category, topics };
};

const getMyCategoriesService = async (autorId) => {
  return await getCategoriesByAuthorId(autorId);
};

const deleteCategoryService = async (userId, userRol, categoryId) => {
  const id = Number(categoryId);
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error('ID inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  
  const category = await getCategoryById(categoryId);

  if (!category) {
    const err = new Error('Categoría no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (category.estado === 'inactiva') {
    const err = new Error('La categoría ya se eliminó');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (userRol !== 'admin' && category.autor_id !== userId) {
    const err = new Error('No tenés permisos para eliminar esta categoría');
    err.code = 'FORBIDDEN';
    throw err;
  }

  await cleanupInactiveTopics(categoryId);

  const hasContent = await categoryHasContent(categoryId);

  if (hasContent) {
    await deactivateCategoryById(categoryId);
    return { action: 'deactivated' };
  }

  await hardDeleteCategoryById(categoryId);
  return { action: 'deleted' };
};

const activeCategoryService = async (userId, userRol, categoryId) => {
  const category = await getCategoryById(categoryId);

  if (!category) {
    const err = new Error('Categoría no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (category.estado === 'activa') {
    const err = new Error('La categoría ya está activa');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (userRol !== 'admin' && category.autor_id !== userId) {
    const err = new Error('No tenés permisos para activar esta categoría');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return await activeCategoryById(categoryId);
};

const updateCategoryService = async (userId, userRol, categoryId, { descripcion, etiquetas, icono }) => {
  if (!descripcion && !etiquetas?.length && icono === undefined) {
    const err = new Error('No hay campos para actualizar');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const category = await getCategoryById(categoryId);
  if (!category) {
    const err = new Error('Categoría no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (category.autor_id !== userId) {
    const err = new Error('No tenés permisos para editar esta categoría');
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (descripcion?.length > 500) {
    const err = new Error('La descripción superó el máximo de caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (etiquetas) {
    const invalidas = etiquetas.filter(e => !ETIQUETAS_VALIDAS.includes(e));
    if (invalidas.length > 0) {
      const err = new Error(`Etiquetas inválidas: ${invalidas.join(', ')}`);
      err.code = 'BAD_REQUEST';
      throw err;
    }
  }

  if (icono !== undefined && !isValidCategoryIcon(icono)) {
    const err = new Error('Ícono inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  return await updateCategoryById(categoryId, { descripcion, etiquetas, icono }, userId);
};

const getActiveCategoriesService = async () => {
  return await getActiveCategories();
};

const getParticipantsByCategoryIdService = async (userId, categoriaId) => {
  const category = await getCategoryById(categoriaId);
  if (!category) {
    const err = new Error('Categoría no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (category.autor_id !== userId) {
    const err = new Error('No tenés permisos para ver los participantes');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return await getParticipantsByCategoryId(categoriaId);
};

const getEtiquetasService = async () => {
  return await getEtiquetas();
};

const getPopularCategoriesService = async (days, limit) => {
  const safeDays = Math.min(Math.max(parseInt(days) || 7, 1), 30);
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 50);
  return await getPopularCategories(safeDays, safeLimit);
};

const getCategoryEditHistoryService = async (categoryId) => {
  const id = Number(categoryId);
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error('ID inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const category = await getCategoryById(categoryId);
  if (!category) {
    const err = new Error('Categoría no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }

  return await getCategoryEditHistory(categoryId);
};

export { createCategoryService, getCategoriesService, getCategoryByIdService, deactivateCategoryById, 
  deleteCategoryService, activeCategoryService, getMyCategoriesService, updateCategoryService, 
  getActiveCategoriesService, getParticipantsByCategoryIdService, getEtiquetasService, 
  getPopularCategoriesService, getCategoryEditHistoryService };