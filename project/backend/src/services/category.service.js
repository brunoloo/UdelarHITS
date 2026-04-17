import { createCategory, findCategoryByTitulo, getCategories, getCategoryById, 
  getTopicsByCategoryId, deactivateCategoryById, activeCategoryById, getCategoriesByAuthorId, updateCategoryById } from '../repositories/category.repository.js';

const ETIQUETAS_VALIDAS = [
  'Lifestyle','Daily life','Relationships','Education','Work & career','Travel',
  'Culture','Food & cooking','Health & fitness','Art','Design','Photography',
  'Film & TV','Writing','Music','Crafts','Animation','Fashion','Tech',
  'Programming','Gadgets','Machine Learning','Cybersecurity','Software','Gaming',
  'Web development','Science','Philosophy','History','Psychology','Politics',
  'Economics','Math','Engineering','Pets','Hobbies','Home & DIY','Cars & motors',
  'Sports','Nature','Environment','Gardening','Memes','News','Reviews',
  'Tutorials','Q&A','Stories','Events','Feedback','Other'
];

const createCategoryService = async (autorId, { titulo, descripcion, etiquetas }) => {
  if (!titulo?.trim() || !descripcion?.trim() || !etiquetas?.length) {
    const err = new Error('Faltan campos obligatorios');
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

  const existing = await findCategoryByTitulo(titulo.trim());
  if (existing) {
    const err = new Error('Ya existe una categoría con ese título');
    err.code = 'TITULO_EXISTS';
    throw err;
  }

  return await createCategory({
    titulo: titulo.trim().toLowerCase(),
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
  const topics = await getTopicsByCategoryId(id);
  return { ...category, topics };
};

const getMyCategoriesService = async (autorId) => {
  return await getCategoriesByAuthorId(autorId);
};

const deleteCategoryService = async (userId, userRol, categoryId) => {
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

  return await deactivateCategoryById(categoryId);
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

const updateCategoryService = async (userId, userRol, categoryId, { descripcion, etiquetas }) => {
  if (!descripcion && !etiquetas?.length) {
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

  if (userRol !== 'admin' && category.autor_id !== userId) {
    const err = new Error('No tenés permisos para editar esta categoría');
    err.code = 'FORBIDDEN';
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

  return await updateCategoryById(categoryId, { descripcion, etiquetas });
};

export { createCategoryService, getCategoriesService, getCategoryByIdService, deactivateCategoryById, 
  deleteCategoryService, activeCategoryService, getMyCategoriesService, updateCategoryService };