import React from "react";
import { statusClass } from "../../utils/helpers.js";

export default function Badge({ status }) {
  return (
    <span className={`status-badge ${statusClass(status)}`}>
      {status || "Unknown"}
    </span>
  );
}
