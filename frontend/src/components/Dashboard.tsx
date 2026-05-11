import React, { useEffect, useState } from "react";
import { RevenueSummary } from "./RevenueSummary";
import { SecureAPI } from "../lib/secureApi";

type DashboardProperty = {
  id: string;
  name: string;
};

type ApiProperty = {
  id?: string | number | null;
  name?: string | null;
};

const Dashboard: React.FC = () => {
  // ISSUE: hardcoded global property list exposed other-tenant properties in the selector.
  // old code:
  // const PROPERTIES = [
  //   { id: 'prop-001', name: 'Beach House Alpha' },
  //   { id: 'prop-002', name: 'City Apartment Downtown' },
  //   { id: 'prop-003', name: 'Country Villa Estate' },
  //   { id: 'prop-004', name: 'Lakeside Cottage' },
  //   { id: 'prop-005', name: 'Urban Loft Modern' }
  // ];
  // FIX: load tenant-scoped properties from secure API and render only allowed options.
  const [properties, setProperties] = useState<DashboardProperty[]>([]);
  const [selectedProperty, setSelectedProperty] = useState("");

  useEffect(() => {
    let active = true;

    const loadProperties = async () => {
      try {
        const response = await SecureAPI.getProperties({ page_size: 1000 });
        const apiProperties: ApiProperty[] = Array.isArray(response?.data) ? response.data : [];
        const normalizedProperties: DashboardProperty[] = apiProperties
          .filter((property) => property?.id && property?.name)
          .map((property) => ({ id: String(property.id), name: String(property.name) }));

        if (!active) return;
        setProperties(normalizedProperties);

        if (normalizedProperties.length > 0) {
          setSelectedProperty((current) =>
            normalizedProperties.some((property) => property.id === current)
              ? current
              : normalizedProperties[0].id
          );
        }
      } catch (error) {
        console.error("Failed to load tenant properties for dashboard selector", error);
      }
    };

    loadProperties();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="p-4 lg:p-6 min-h-full">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">Property Management Dashboard</h1>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
              <div>
                <h2 className="text-lg lg:text-xl font-medium text-gray-900 mb-2">Revenue Overview</h2>
                <p className="text-sm lg:text-base text-gray-600">
                  Monthly performance insights for your properties
                </p>
              </div>
              
              {/* Property Selector */}
              <div className="flex flex-col sm:items-end">
                <label className="text-xs font-medium text-gray-700 mb-1">Select Property</label>
                <select
                  value={selectedProperty}
                  onChange={(e) => setSelectedProperty(e.target.value)}
                  disabled={properties.length === 0}
                  className="block w-full sm:w-auto min-w-[200px] px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {selectedProperty ? (
              <RevenueSummary propertyId={selectedProperty} />
            ) : (
              <div className="rounded-md border border-gray-200 p-4 text-sm text-gray-600">
                No tenant properties available.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
