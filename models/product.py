from odoo import models, fields, api

class ProductTemplate(models.Model):
    _inherit = 'product.template'

    low_stock_warning = fields.Boolean(
        string="Low Stock Warning",
        compute='_compute_low_stock_warning',
        store=True,
        default=False
    )

    min_low_stock_alert = fields.Float(
        string="Low Stock Alert Threshold", 
        default=10.0,
        help="Minimum quantity threshold for displaying low stock warning"
    )

    pos_product_qty_limit = fields.Float(
        string="POS Quantity Limit",
        default=2,
        help="Maximum quantity that can be ordered in POS. 0 means no limit.",
        store=True
    )

    @api.depends('qty_available')
    def _compute_low_stock_warning(self):
        for product in self:
            product.low_stock_warning = product.qty_available < product.min_low_stock_alert


class ProductProduct(models.Model):
    _inherit = 'product.product'
    
    # Add this field to make it available at product variant level
    min_low_stock_alert = fields.Float(related='product_tmpl_id.min_low_stock_alert', store=True)
    pos_product_qty_limit = fields.Float(related='product_tmpl_id.pos_product_qty_limit', store=True)
    
    # Add a computed field with hardcoded threshold
    is_low_stock = fields.Boolean(
        string="Low Stock Status", 
        compute='_compute_is_low_stock',
        store=True,
        help="Indicates if product quantity is below 10 units"
    )
    
    @api.depends('qty_available')
    def _compute_is_low_stock(self):
        for product in self:
            product.is_low_stock = product.qty_available < 10
    
    @api.model
    def nt_get_product_info_pos(self, product_ids, location_id, product_id):
        """
        Get available quantity for a product at a specific location for POS
        
        Args:
            product_ids: Array with product id
            location_id: Stock location id
            product_id: Product id (redundant parameter)
            
        Returns:
            Dictionary with quantity, threshold and quantity limit
        """
        product = self.browse(product_ids[0])
        
        # Get quantity available at the specific location
        quants = self.env['stock.quant'].search([
            ('product_id', '=', product.id),
            ('location_id', '=', location_id)
        ])
        
        quantity = sum(quant.quantity for quant in quants)
        
        # Return quantity, threshold and quantity limit in one response
        return {
            'quantity': quantity, 
            'threshold': product.min_low_stock_alert or 10.0,
            'pos_qty_limit': product.pos_product_qty_limit or 2
        }


class PosConfig(models.Model):
    _inherit = 'pos.config'

    @api.model
    def _default_product_fields(self):
        fields = super()._default_product_fields()
        fields.extend(['min_low_stock_alert', 'pos_product_qty_limit'])
        return fields


