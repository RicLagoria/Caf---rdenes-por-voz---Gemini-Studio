
import React from 'react';
import { MENU } from '../constants';
import { MenuItem } from '../types';

const MenuDisplay: React.FC = () => {
    const groupedMenu = MENU.reduce((acc, item) => {
        (acc[item.categoria] = acc[item.categoria] || []).push(item);
        return acc;
    }, {} as Record<string, MenuItem[]>);

    return (
        <div className="w-full max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow-lg">
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Nuestro Menú</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(groupedMenu).map(([category, items]) => (
                    <div key={category} className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="text-xl font-semibold text-amber-800 mb-3 border-b-2 border-amber-200 pb-2">{category}</h3>
                        <ul>
                            {items.map((item) => (
                                <li key={item.id} className="flex justify-between items-center py-1 text-gray-700">
                                    <span>{item.nombre}</span>
                                    <span className="font-medium">${item.precio.toLocaleString('es-AR')}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MenuDisplay;
