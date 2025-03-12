/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { Product } from "@point_of_sale/app/store/models";
import { Order } from "@point_of_sale/app/store/models";
import { Orderline } from "@point_of_sale/app/store/models";
import { ErrorPopup } from "@point_of_sale/app/errors/popups/error_popup";
import { _t } from "@web/core/l10n/translation";

patch(Product.prototype, {
    get imageUrl() {
        const originalUrl = super.imageUrl;
        return originalUrl;
    },

    getStockStatusClass() {
        if (this.stock_status === 'critical') {
            return 'pos-stock-critical';
        } else if (this.stock_status === 'warning') {
            return 'pos-stock-warning';
        }
        return '';
    }
});

patch(Order.prototype, {
    async add_product(product, options = {}) {
        // Check quantity limit before adding
        const line = this.get_orderline_by_product_id(product.id);
        const currentQty = line ? line.get_quantity() : 0;
        const addingQty = options.quantity || 1;
        const newQty = currentQty + addingQty;

        // Check if product is out of stock
        if (product.type === 'product' && product.quantity <= 0) {
            this.env.services.popup.add(ErrorPopup, {
                title: _t('Out of Stock'),
                body: _t(`${product.display_name} is out of stock and cannot be sold.`),
            });
            return;
        }
        
        // Check quantity limits
        if (product.pos_product_qty_limit > 0 && newQty > product.pos_product_qty_limit) {
            this.env.services.popup.add(ErrorPopup, {
                title: _t('Quantity Limit Exceeded'),
                body: _t(`Cannot add more than ${product.pos_product_qty_limit} units of "${product.display_name}".`),
            });
            return;
        }

        const result = await super.add_product(...arguments);


        return result;
    },
    
    get_orderline_by_product_id(product_id) {
        return this.orderlines.find(line => line.product.id === product_id);
    },

    // Keep the pay method for final validation
    async pay() {
        return super.pay(...arguments);
    }
});

patch(Orderline.prototype, {
    set_quantity(quantity, keep_price) {
        const newQty = typeof quantity === 'number' ? quantity : Number(quantity);

        if (this.product.pos_product_qty_limit > 0 && newQty > this.product.pos_product_qty_limit) {
            this.pos.env.services.popup.add(ErrorPopup, {
                title: _t('Quantity Limit Exceeded'),
                body: _t(`Cannot set quantity to more than ${this.product.pos_product_qty_limit} units of "${this.product.display_name}".`),
            });
            return false;
        }

        return super.set_quantity(...arguments);
    },
});

patch(PosStore.prototype, {
    async _loadProductProduct(products) {
        const productMap = {};
        const productTemplateMap = {};

        const warehouse_id = this.config.warehouse_id[0];
        const warehouse = await this.orm.call('stock.warehouse', 'search_read', [[['id', '=', warehouse_id]]], { limit: 1 });
        const location = warehouse[0].lot_stock_id[0]; 
        const stockQuantityMap = {};

        for (const product of products) {
            const productInfo = await this.orm.call("product.product", "nt_get_product_info_pos", [
                [product.id],
                location,
                product.id,
            ]);
            stockQuantityMap[product.id] = productInfo;
        }

        console.log("stockQuantityMap:", stockQuantityMap);    

        const modelProducts = products.map((product) => {
            console.log(`Product ${product.id} info:`, stockQuantityMap[product.id]);
            
            product.pos = this;
            product.env = this.env;
            product.applicablePricelistItems = {};
            
            const info = stockQuantityMap[product.id] || {
                quantity: 0, 
                threshold: 10.0,
                pos_qty_limit: 0
            };
            
            product.quantity = info.quantity;
            product.min_low_stock_alert = info.threshold;
            product.pos_product_qty_limit = info.pos_qty_limit;
            product.stock_status = info.stock_status;
            
            productMap[product.id] = product;
            productTemplateMap[product.product_tmpl_id[0]] = (
                productTemplateMap[product.product_tmpl_id[0]] || []
            ).concat(product);
            return new Product(product);
        });

        for (const pricelist of this.pricelists) {
            for (const pricelistItem of pricelist.items) {
                if (pricelistItem.product_id) {
                    const product_id = pricelistItem.product_id[0];
                    const correspondingProduct = productMap[product_id];
                    if (correspondingProduct) {
                        this._assignApplicableItems(pricelist, correspondingProduct, pricelistItem);
                    }
                } else if (pricelistItem.product_tmpl_id) {
                    const product_tmpl_id = pricelistItem.product_tmpl_id[0];
                    const correspondingProducts = productTemplateMap[product_tmpl_id];
                    for (const correspondingProduct of correspondingProducts || []) {
                        this._assignApplicableItems(pricelist, correspondingProduct, pricelistItem);
                    }
                } else {
                    for (const correspondingProduct of products) {
                        this._assignApplicableItems(pricelist, correspondingProduct, pricelistItem);
                    }
                }
            }
        }
        this.db.add_products(modelProducts);
    },
});