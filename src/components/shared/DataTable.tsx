import React from "react";
import { DataGrid, GridColDef, GridToolbar } from "@mui/x-data-grid";
import { Box, useTheme, alpha } from "@mui/material";

interface DataTableProps {
  rows: any[];
  columns: GridColDef[];
  loading?: boolean;
  getRowId?: (row: any) => string | number;
  onRowClick?: (params: any) => void;
  density?: "compact" | "standard" | "comfortable";
  autoHeight?: boolean;
  checkboxSelection?: boolean;
  onRowSelectionModelChange?: (newSelectionModel: any) => void;
  rowSelectionModel?: any[];
}

export const DataTable: React.FC<DataTableProps> = ({
  rows,
  columns,
  loading = false,
  getRowId,
  onRowClick,
  density = "compact",
  autoHeight = true,
  checkboxSelection = false,
  onRowSelectionModelChange,
  rowSelectionModel,
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        width: "100%",
        height: autoHeight ? "auto" : "100%",
        "& .MuiDataGrid-root": {
          border: "none",
          backgroundColor: "transparent",
        },
        "& .MuiDataGrid-cell": {
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          fontSize: "0.875rem",
        },
        "& .MuiDataGrid-columnHeaders": {
          backgroundColor: alpha(theme.palette.background.paper, 0.5),
          borderBottom: `1px solid ${theme.palette.divider}`,
          fontWeight: "bold",
        },
        "& .MuiDataGrid-footerContainer": {
          borderTop: `1px solid ${theme.palette.divider}`,
        },
        "& .MuiDataGrid-row:hover": {
          backgroundColor: alpha(theme.palette.primary.main, 0.04),
          cursor: onRowClick ? "pointer" : "default",
        },
      }}
    >
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        getRowId={getRowId}
        onRowClick={onRowClick}
        density={density}
        autoHeight={autoHeight}
        checkboxSelection={checkboxSelection}
        onRowSelectionModelChange={onRowSelectionModelChange as any}
        rowSelectionModel={rowSelectionModel as any}
        disableRowSelectionOnClick
        slots={{ toolbar: GridToolbar }}
        slotProps={{
          toolbar: {
            showQuickFilter: true,
            quickFilterProps: { debounceMs: 500 },
          },
        }}
        sx={{
          "& .MuiDataGrid-main": {
            borderRadius: "12px",
            overflow: "hidden",
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      />
    </Box>
  );
};
