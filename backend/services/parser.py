import pandas as pd
import os

def read_project_excel(project_name: str):
    excel_path = f"backend/projects/{project_name}/input.xlsx"

    if not os.path.exists(excel_path):
        return False, "Excel file not found."

    required_sheets = {
        "project_info": [
            "project_name", "location", "latitude", "longitude",
            "installed_capacity_dc", "installed_capacity_ac",
            "design_voltage_dc", "design_voltage_ac", "design_voltage_mv",
            "execution_year", "inverter_model", "number_of_inverters",
            "inverter_station_model", "panel_model", "number_of_panels", "notes"
        ],
        "dc_string_circuits": [
            "string_id", "length_pos_m", "length_neg_m", "cn1_id", "inverter_id", "section_mm2"
        ],
        "dc_cn1_circuits": [
            "circuit_id", "length_pos_m", "length_neg_m", "section_mm2"
        ],
        "ac_circuits": [
            "circuit_id", "length_pos_m", "length_neg_m", "phases", "section_mm2"
        ],
        "mv_circuits": [
            "circuit_id", "length_m", "phases", "section_mm2"
        ],
    }

    try:
        xl = pd.ExcelFile(excel_path)
        found_sheets = xl.sheet_names

        missing_sheets = set(required_sheets) - set(found_sheets)
        if missing_sheets:
            return False, f"Missing sheets: {', '.join(missing_sheets)}"

        for sheet, expected_cols in required_sheets.items():
            df = xl.parse(sheet)
            missing_cols = set(expected_cols) - set(df.columns)
            if missing_cols:
                return False, f"Missing columns in '{sheet}': {', '.join(missing_cols)}"

        return True, xl

    except Exception as e:
        return False, f"Error reading Excel: {str(e)}"
