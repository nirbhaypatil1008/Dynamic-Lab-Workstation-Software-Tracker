import React from "react";
import { formatBytes, formatDate } from "../../utils/helpers.js";

export function StructuredFields({ fields }) {
  return (
    <dl className="structured-fields">
      {fields.map(([label, value], idx) => {
        const displayValue =
          value !== null && value !== undefined && String(value).trim() !== ""
            ? String(value)
            : "Not reported";
        return (
          <div key={idx}>
            <dt>{label}</dt>
            <dd>{displayValue}</dd>
          </div>
        );
      })}
    </dl>
  );
}

export function SoftwareDetails({ items = [], label = "Detected software" }) {
  return (
    <details className="structured-details software-details">
      <summary>
        {label} <span className="detail-count">{items.length}</span>
      </summary>
      {items.length ? (
        <ul className="software-inventory-list">
          {items.map((item, idx) => (
            <li key={idx}>
              <strong>{item.name}</strong>
              <StructuredFields
                fields={[
                  ["Version", item.version || "Not reported"],
                  ["Publisher", item.publisher || "Not reported"],
                  ["Detection source", item.source || "Not reported"],
                  ["Last detected", formatDate(item.detected_at)]
                ]}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted-copy">No detected software has been reported.</p>
      )}
    </details>
  );
}

export function StructuredWorkstationDetails({ item }) {
  return (
    <details className="structured-details workstation-details">
      <summary>Structured details</summary>
      <div className="structured-detail-grid">
        <section>
          <h4>Identification</h4>
          <StructuredFields
            fields={[
              ["Workstation ID", item.id],
              ["Hostname", item.hostname],
              ["Laboratory", item.lab],
              ["Room", item.room],
              ["Status", item.status],
              ["IP Address", item.ipAddress || "Not reported"],
              ["Agent Version", item.agentVersion || "1.0.0"]
            ]}
          />
        </section>
        <section>
          <h4>System and hardware</h4>
          <StructuredFields
            fields={[
              ["Operating system", item.os],
              ["Processor", item.cpu],
              ["Memory capacity", formatBytes(item.memoryTotalBytes)],
              ["Disk capacity", formatBytes(item.diskTotalBytes)]
            ]}
          />
        </section>
        <section>
          <h4>Connectivity and inventory</h4>
          <StructuredFields
            fields={[
              ["Last heartbeat", formatDate(item.lastHeartbeat)],
              ["Inventory scan", formatDate(item.lastInventoryScan)],
              ["Inventory freshness", item.inventoryFreshness],
              ["Network", item.health?.network],
              ["Metrics reported", formatDate(item.health?.reportedAt)]
            ]}
          />
        </section>
        <section>
          <h4>Latest health metrics</h4>
          <StructuredFields
            fields={[
              [
                "CPU usage",
                item.health?.cpuPercent == null
                  ? "Not available"
                  : `${item.health.cpuPercent}%`
              ],
              [
                "Memory usage",
                item.health?.memoryPercent == null
                  ? "Not available"
                  : `${item.health.memoryPercent}%`
              ],
              [
                "Disk usage",
                item.health?.diskPercent == null
                  ? "Not available"
                  : `${item.health.diskPercent}%`
              ]
            ]}
          />
        </section>
      </div>
      <SoftwareDetails items={item.software} />
    </details>
  );
}
