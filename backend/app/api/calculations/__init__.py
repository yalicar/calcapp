from fastapi import APIRouter

# Crear el router principal del módulo "calculations"
router = APIRouter()

# ==============================================================================
# 🌐 MÓDULO: normative_status.py
# Descripción: Endpoints para consultar el estado de configuración normativa.
# ==============================================================================

from .normative_status import get_project_normative_status
from .normative_status import get_available_normatives
from .normative_status import router as normative_status_router


# ==============================================================================
# ⚙️ MÓDULO: normative_parameters.py
# Descripción: Endpoints para leer, guardar, eliminar y copiar normativas por etapa
# ==============================================================================

from .normative_parameters import (
    get_base_normative_parameters,
    get_project_stage_normative,
    save_stage_normative_parameters,
    delete_stage_normative_parameters,
    copy_base_normative_to_all_stages,
    router as normative_parameters_router
)


# ==============================================================================
# 🔁 MÓDULO UNIFICADO: string_calculation.py
# Descripción: Cálculo de circuitos string con normativa IEC y NEC
# ==============================================================================

from .string_calculation import calculate_iec_strings, calculate_nec_strings
from .string_calculation import router as string_calculation_router


# ==============================================================================
# ✅ REGISTRO DE ROUTERS
# Incluye cada subrouter con su correspondiente tag
# ==============================================================================

router.include_router(normative_status_router, tags=["Normative Status"])
router.include_router(normative_parameters_router, tags=["Normative Parameters"])
router.include_router(string_calculation_router, tags=["String Calculations"])