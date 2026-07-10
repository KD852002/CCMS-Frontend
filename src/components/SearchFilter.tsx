'use client';

import React, { useState, useCallback } from 'react';
import { Box, TextField, Select, MenuItem, InputAdornment, Chip } from '@mui/material';
import { Search, X } from 'lucide-react';

export interface FilterOptions {
  search: string;
  status: 'all' | 'online' | 'offline' | 'fault';
  type: 'all' | string;
}

interface SearchFilterProps {
  onFilterChange: (filters: FilterOptions) => void;
  availableTypes?: string[];
  placeholder?: string;
}

export const SearchFilter: React.FC<SearchFilterProps> = ({
  onFilterChange,
  availableTypes = [],
  placeholder = 'Search by device ID, model, or location...',
}) => {
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    status: 'all',
    type: 'all',
  });

  const handleFilterChange = useCallback((updates: Partial<FilterOptions>) => {
    const newFilters = { ...filters, ...updates };
    setFilters(newFilters);
    onFilterChange(newFilters);
  }, [filters, onFilterChange]);

  return (
    <Box sx={{
      display: 'flex',
      gap: 2,
      flexWrap: 'wrap',
      p: 2.5,
      borderRadius: 2.5,
      border: '1px solid #e5e7eb',
      backgroundColor: '#f9fafb',
      mb: 3,
    }}>
      <TextField
        placeholder={placeholder}
        value={filters.search}
        onChange={(e) => handleFilterChange({ search: e.target.value })}
        variant="outlined"
        size="small"
        sx={{
          flex: 1,
          minWidth: 250,
          '& .MuiOutlinedInput-root': {
            borderRadius: 1.5,
            backgroundColor: '#ffffff',
            '&:hover fieldset': { borderColor: '#1f6c7e' },
            '&.Mui-focused fieldset': { borderColor: '#1f6c7e' },
          },
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search size={18} color="#9ca3af" />
            </InputAdornment>
          ),
          endAdornment: filters.search ? (
            <InputAdornment position="end">
              <button
                onClick={() => handleFilterChange({ search: '' })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                <X size={16} color="#9ca3af" />
              </button>
            </InputAdornment>
          ) : undefined,
        }}
      />

      <Select
        value={filters.status}
        onChange={(e) => handleFilterChange({ status: e.target.value as FilterOptions['status'] })}
        size="small"
        sx={{
          minWidth: 140,
          borderRadius: 1.5,
          backgroundColor: '#ffffff',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e5e7eb' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1f6c7e' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1f6c7e' },
        }}
      >
        <MenuItem value="all">All Status</MenuItem>
        <MenuItem value="online">Online</MenuItem>
        <MenuItem value="offline">Offline</MenuItem>
        <MenuItem value="fault">Fault</MenuItem>
      </Select>

      {availableTypes.length > 0 && (
        <Select
          value={filters.type}
          onChange={(e) => handleFilterChange({ type: e.target.value })}
          size="small"
          sx={{
            minWidth: 140,
            borderRadius: 1.5,
            backgroundColor: '#ffffff',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e5e7eb' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1f6c7e' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1f6c7e' },
          }}
        >
          <MenuItem value="all">All Types</MenuItem>
          {availableTypes.map(type => (
            <MenuItem key={type} value={type}>{type}</MenuItem>
          ))}
        </Select>
      )}

      {(filters.search || filters.status !== 'all' || filters.type !== 'all') && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {filters.search && (
            <Chip label={`Search: ${filters.search}`} onDelete={() => handleFilterChange({ search: '' })} size="small" sx={{ borderRadius: 1 }} />
          )}
          {filters.status !== 'all' && (
            <Chip label={`Status: ${filters.status}`} onDelete={() => handleFilterChange({ status: 'all' })} size="small" sx={{ borderRadius: 1 }} />
          )}
          {filters.type !== 'all' && (
            <Chip label={`Type: ${filters.type}`} onDelete={() => handleFilterChange({ type: 'all' })} size="small" sx={{ borderRadius: 1 }} />
          )}
        </Box>
      )}
    </Box>
  );
};
