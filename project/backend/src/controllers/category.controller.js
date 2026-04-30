import { createCategoryService, getCategoriesService, getCategoryByIdService, 
  deleteCategoryService, activeCategoryService, getMyCategoriesService, 
  updateCategoryService, getActiveCategoriesService, 
  getParticipantsByCategoryIdService, getEtiquetasService } from '../services/category.service.js';

const createCategory = async (req, res) => {
  try {
    const category = await createCategoryService(req.user.id, req.body);
    return res.status(201).json({ 
        ok: true,
        message: 'Categoría creada correctamente', 
        data: category });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'TITULO_EXISTS') return res.status(409).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = await getCategoriesService();
    return res.status(200).json({ ok: true, data: categories });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getMyCategories = async (req, res) => {
  try {
    const categories = await getMyCategoriesService(req.user.id);
    return res.status(200).json({ ok: true, data: categories });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await getCategoryByIdService(id);
    return res.status(200).json({ ok: true, data: category });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await deleteCategoryService(req.user.id, req.user.rol, id);
    return res.status(200).json({ 
      ok: true,
      message: 'La categoría se desactivo correctamente', 
      data: updated });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const activeCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await activeCategoryService(req.user.id, req.user.rol, id);
    return res.status(200).json({ 
      ok: true,
      message: 'La categoría se activo correctamente', 
      data: updated });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await updateCategoryService(req.user.id, req.user.rol, id, req.body);
    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getActiveCategories = async (req, res) => {
  try {
    const categories = await getActiveCategoriesService();
    return res.status(200).json({ ok: true, data: categories });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getParticipantsByCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const participants = await getParticipantsByCategoryIdService(req.user.id, id);
    return res.status(200).json({ ok: true, data: participants });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getEtiquetasList = async (req, res) => {
  try {
    const etiquetas = await getEtiquetasService();
    return res.status(200).json({ ok: true, data: etiquetas });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

export { createCategory, getCategories, getCategoryById, deleteCategory, activeCategory, 
  getMyCategories, updateCategory, getActiveCategories, getParticipantsByCategory, getEtiquetasList };