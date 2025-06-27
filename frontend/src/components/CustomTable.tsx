import React from 'react';
import {
  useTable,
  useBlockLayout,
} from 'react-table';
import { Box } from '@mui/material';
import './CustomTable.css';

interface Props {
  columns: any[];
  data: any[];
}

const CustomTable: React.FC<Props> = ({ columns, data }) => {
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable(
    {
      columns,
      data,
    },
    useBlockLayout
  );

  return (
    <Box
      sx={{
        overflowX: 'auto',
        width: '100%',
        backgroundColor: '#1e1e1e',
        borderRadius: '4px',
        padding: 1,
      }}
    >
      <div {...getTableProps()} className="custom-table">
        <div className="table-header">
          {headerGroups.map(headerGroup => (
            <div {...headerGroup.getHeaderGroupProps()} className="table-row">
              {headerGroup.headers.map(column => (
                <div {...column.getHeaderProps()} className="table-header-cell">
                  {column.render('Header')}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div {...getTableBodyProps()} className="table-body">
          {rows.map(row => {
            prepareRow(row);
            return (
              <div {...row.getRowProps()} className="table-row">
                {row.cells.map(cell => (
                  <div {...cell.getCellProps()} className="table-cell">
                    {cell.render('Cell')}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </Box>
  );
};

export default CustomTable;
