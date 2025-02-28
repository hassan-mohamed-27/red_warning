/** @odoo-module **/

import { registry } from "@web/core/registry";

/*
 * Extend POS product model to load the 'low_stock_warning' field.
 */
registry.category("product").add("low_stock_warning", {
    fields: ["low_stock_warning"],
});
