import pytest
from backend.services.calculation.string_calculator import calcular_seccion_minima_simple
from math import isclose

def test_seccion_minima_simple():
    corriente = 11.88  # A
    longitud = 20      # m
    caida_pct = 3.0    # %
    tension = 1500     # V
    resistividad = 0.0172  # Ω·mm²/m

    resultado = calcular_seccion_minima_simple(corriente, longitud, caida_pct, tension, resistividad)
    esperado = (resistividad * longitud * corriente) / (tension * caida_pct / 100)
    esperado = round(esperado, 3)

    print(f"\nSección calculada: {resultado:.3f} mm², Esperada: {esperado:.3f} mm²")
    assert isclose(resultado, esperado, rel_tol=1e-4)
