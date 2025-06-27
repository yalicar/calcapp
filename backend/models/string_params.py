# backend/models/string_params.py
from pydantic import BaseModel
from typing import Literal, Optional

class StringCalculationParams(BaseModel):
    isc_ref: float
    isc_correction: float
    number_of_parallel_strings: int

    cable_material: Literal["copper", "aluminum"]
    cable_max_temp: float

    method: Literal["buried", "tray_perforated", "tray_non_perforated", "conduit"]
    layout: Optional[Literal["single_layer", "multilayer"]] = None
    separation: Optional[bool] = True
    depth_cm: Optional[int] = 60

    current_ambient: int
    reference_voltage: float
    max_voltage_drop_pct: float
