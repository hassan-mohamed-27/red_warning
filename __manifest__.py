{
    "name": "Red Warning Stock",
    "version": "1.0",
    "summary": "Displays a red warning when product stock is below a threshold.",
    "author": "Your Name",
    "depends": ["product", "stock", "point_of_sale"],
    "data": [
        "views/product_warning_view.xml"
    ],
    "installable": True,
    "application": False
, 
    'assets': {
        'point_of_sale._assets_pos': [
            'red_warning/static/src/js/pos_red_warning_extension.js',
            'red_warning/static/src/css/stock_border.css',
            'red_warning/static/src/css/pos_red_warning.css',
           
            'red_warning/static/src/xml/patch.xml',
            
        ],
    }
}
