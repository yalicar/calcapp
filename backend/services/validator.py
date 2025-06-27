import pandas as pd
import re
from typing import List

def validate_project_info(df):
    errors = []
    required_fields = [
        "project_name", "location", "latitude", "longitude",
        "installed_capacity_dc", "installed_capacity_ac",
        "design_voltage_dc", "design_voltage_ac", "design_voltage_mv",
        "execution_year", "inverter_model", "number_of_inverters",
        "inverter_station_model", "panel_model", "number_of_panels", "notes"
    ]
    for field in required_fields:
        if field not in df.columns:
            errors.append(f"Missing column: {field}")
    return errors

def validate_dc_string_circuits(df):
    errors = []
    for index, row in df.iterrows():
        row_num = index + 2
        if not isinstance(row['string_id'], str) or not re.match(r"^str-\d+-\d+-CN1-\d+-\d+$", row['string_id']):
            errors.append(f"Row {row_num}: Invalid string_id format -> {row['string_id']}")
        for col in ['length_pos_m', 'length_neg_m']:
            if pd.isna(row[col]) or not isinstance(row[col], (int, float)) or row[col] <= 0:
                errors.append(f"Row {row_num}: Invalid value in '{col}' -> {row[col]}")
        if pd.isna(row['cn1_id']) or not isinstance(row['cn1_id'], str):
            errors.append(f"Row {row_num}: 'cn1_id' is missing or invalid.")
        if pd.isna(row['inverter_id']) or not isinstance(row['inverter_id'], str):
            errors.append(f"Row {row_num}: 'inverter_id' is missing or invalid.")
    return errors

def validate_dc_cn1_circuits(df):
    errors = []
    for index, row in df.iterrows():
        row_num = index + 2
        if not isinstance(row['circuit_id'], str) or not row['circuit_id'].startswith("cn1-"):
            errors.append(f"Row {row_num}: Invalid circuit_id -> {row['circuit_id']}")
        for col in ['length_pos_m', 'length_neg_m']:
            if pd.isna(row[col]) or not isinstance(row[col], (int, float)) or row[col] <= 0:
                errors.append(f"Row {row_num}: Invalid value in '{col}' -> {row[col]}")
        if pd.isna(row['section_mm2']) or not isinstance(row['section_mm2'], (int, float)) or row['section_mm2'] <= 0:
            errors.append(f"Row {row_num}: Invalid section_mm2 -> {row['section_mm2']}")
    return errors

def validate_ac_circuits(df):
    errors = []
    for index, row in df.iterrows():
        row_num = index + 2
        if not isinstance(row['circuit_id'], str) or not row['circuit_id'].startswith("ac-"):
            errors.append(f"Row {row_num}: Invalid circuit_id -> {row['circuit_id']}")
        for col in ['length_pos_m', 'length_neg_m']:
            if pd.isna(row[col]) or not isinstance(row[col], (int, float)) or row[col] <= 0:
                errors.append(f"Row {row_num}: Invalid value in '{col}' -> {row[col]}")
        if pd.isna(row['phases']) or row['phases'] not in [1, 3]:
            errors.append(f"Row {row_num}: Invalid phases value -> {row['phases']}")
        if pd.isna(row['section_mm2']) or not isinstance(row['section_mm2'], (int, float)) or row['section_mm2'] <= 0:
            errors.append(f"Row {row_num}: Invalid section_mm2 -> {row['section_mm2']}")
    return errors

def validate_mv_circuits(df: pd.DataFrame) -> List[str]:
    errors = []
    for index, row in df.iterrows():
        row_num = index + 2
        if pd.isna(row['circuit_id']) or not isinstance(row['circuit_id'], str):
            errors.append(f"Row {row_num}: 'circuit_id' is missing or invalid.")
        if pd.isna(row['length_m']) or not isinstance(row['length_m'], (int, float)) or row['length_m'] <= 0:
            errors.append(f"Row {row_num}: Invalid 'length_m' -> {row['length_m']}")
        if pd.isna(row['phases']) or not isinstance(row['phases'], int) or row['phases'] not in [1, 3]:
            errors.append(f"Row {row_num}: Invalid 'phases' -> {row['phases']}")
        if pd.isna(row['section_mm2']) or not isinstance(row['section_mm2'], (int, float)) or row['section_mm2'] <= 0:
            errors.append(f"Row {row_num}: Invalid 'section_mm2' -> {row['section_mm2']}")
    return errors
