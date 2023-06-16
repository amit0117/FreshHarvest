const express=require('express')
const ejs=require('ejs')
const bodyParser=require('body-parser')
const mysql=require('mysql')
const session=require('express-session')
const app=express()
app.use(express.static('public'))
app.set('view engine','ejs')
app.use(bodyParser.urlencoded({extended:true}))
const SECRET_KEY="sk_test_51NDOT3SJLI4vnAghFfsMJ1t2d0EzypvxW1yhxaSDtPeDVbP1AeVgYSXFfSXNKFRjAh6L8iilOGF94Uz8rS5dwXpl00EfgRZwQo"
const PUBLISHIBLE_KEY="pk_test_51NDOT3SJLI4vnAgh7X33wlPk4jcPXGEuNuNnUTyDQE4CwBPaz78hKHDiuMRzLxOLtKqlJRsBk4l3tCWqRe2wdkFh00Jn7IKHRL"
const stripe=require('stripe')(SECRET_KEY)
const connect=mysql.createConnection(
    {
        host:'sql12.freemysqlhosting.net',
        user:'sql12626755',
        password:'eUm9rQZ9P9',
        database:'sql12626755'
    }
    )
    app.use(session({secret:"ANYSECRETKEYHERE"}))


    app.get('/',(req,res)=>{
        connect.query("SELECT * FROM products",(err,result)=>{
            if(err){
                return res.render('pages/error',{err:err})
            }
            res.render("pages/index",{result:result})
        })
    })
    
    
    
    
    // add to cart route
    function isProductInCart(cart,id){
        for(let i=0;i<cart.length;++i){
            if(cart[i].id==id)return true
        }
        return false
    }
    // calculating total cost
    function calculateTotal(cart,req){
        let total=0;
        for(let i=0;i<cart.length;++i){
            if(cart[i].sales_price){
                total+=cart[i].sales_price*cart[i].quantity
            }else total+=cart[i].price*cart[i].quantity
        }
        req.session.total=total
        return total
    }
    app.post('/add_to_cart',(req,res)=>{
        var id=req.body.id;
        var name=req.body.name
        var price=req.body.price
        var sales_price=req.body.sales_price;
        var price=req.body.price;
        var image=req.body.image;
        var quantity=req.body.quantity;
    const product={
        id,name,price,sales_price,image,quantity
    } 
    if(req.session.cart){
        const cart=req.session.cart
     if(!isProductInCart(cart,id))
     cart.push(product)
    }
    else{
        req.session.cart=[product]
    }
    const cart=req.session.cart
    // calculating cost
    calculateTotal(cart,req)
    
    // return to the cart
    res.redirect('/cart')
    
})
// removing product from out database
app.post('/remove_product',(req,res)=>{
    
    const cart=req.session.cart
    if(cart &&cart.length){
        const newcart=cart.filter(item=>item.id!==req.body.id)
        req.session.cart=newcart
        calculateTotal(newcart,req)
    }
    res.redirect('/cart')
})
app.post('/edit_product_quantity',(req,res)=>{
    const {id,quantity,increase,decrease}=req.body
    let cart=req.session.cart
    if(increase && cart){
        
        for(let i=0;i<cart.length;++i)
        if(cart[i].id===id && cart[i].quantity>0)
        cart[i].quantity=parseInt(cart[i].quantity)+1
    }
    if(decrease && cart){
        
        for(let i=0;i<cart.length;++i)
        if(cart[i].id===id && cart[i].quantity>1)
        cart[i].quantity=parseInt(cart[i].quantity)-1
    }
    calculateTotal(cart,req)
    res.redirect('/cart')
})

app.get('/index.html',(req,res)=>{
    res.redirect('/')
})
// creating cart route
app.get('/cart',(req,res)=>{
    const cart=req.session.cart
    const total=req.session.total
    res.render('pages/cart',{cart:cart,total:total})
    
})


// place order and checkout
app.get('/checkout',(req,res)=>{
    let total=req.session.total
    res.render('pages/checkout',{total:total})
})
app.post('/place_order',(req,res)=>{
    let {name,email,phone,city,address}=req.body
    let status='not paid';
    const cost=req.session.total
    const date = new Date();
    let product_ids=''
    let cart=req.session.cart
    var id=Date.now()
    // console.log(id)
    req.session.order_id=id
    for(let i=0;cart&&i<cart.length;++i){
        product_ids+=''+cart[i].id
    }
    
    
    var query=`INSERT INTO orders(id,cost,name,email,status,city,address,phone,date,product_id) VALUES ?`
    var values=[[id,cost,name,email,status,city,address,phone,date,product_ids]]
    connect.query(query, [values], (error, results, fields) => {
        if (error) {
            return res.render('pages/error',{err:error})
        }
        res.redirect('/payment')
    })
    for(let i=0;i<cart.length;++i){
        var query1='INSERT INTO order_items (order_id,product_id,product_name,product_price,product_image,product_quantity,order_date) values ?'
        var values1=[
            [id,cart[i].id,cart[i].name,cart[i].price,cart[i].image,cart[i].quantity,new Date()]
        ]
        connect.query(query1,[values1],(err,result)=>{
            if(err){
                return res.render('pages/error',{err:err})

            }
            // else console.log('Product inserted into database successfully')
        })
    }    
})





// payment route
app.get('/payment',(req,res)=>{
    var total=req.session.total
res.render('pages/payment',{total:total,PUBLISHIBLE_KEY:PUBLISHIBLE_KEY})
})




app.get('/verify_payment',(req,res)=>{
    
    const transaction_id=req.query.transaction_id
    const order_id=req.session.order_id
    const query='INSERT INTO payments (order_id,transaction_id,date) VALUES ?'
    // console.log('payment',transaction_id,"    ",order_id)
    const values=[[order_id,transaction_id,new Date()]]
    connect.query(query,[values],(err,result)=>{
        if(err){
            // console.log("in verify_payment")
            return res.render('pages/error',{err:err})
        }
        else {
       const{stripeEmail,stripeToken,stripeTokenType,total,order_id}=req.session
    //    console.log("in verify payment after error")
    connect.query(`UPDATE orders SET status='paid' WHERE id=${order_id}`,(err,result)=>{

        if(err){
            return res.render('pages/error',{err:err})
        }
            // console.log(order_id,"   ",transaction_id)
            const status='paid'
            return res.render('pages/thank_you',{stripeEmail,stripeToken,stripeTokenType,total,order_id,status})  // If no error occurs
    })
        }
    })
})
app.post('/payment',(req, res)=>{
 
    // Moreover you can take more details from user
    // like Address, Name, etc from form
    const {stripeToken,stripeTokenType,stripeEmail}=req.body
    const total=req.session.total
    //  console.log(req.body)
    stripe.customers.create({
        email: req.body.stripeEmail,
        source: req.body.stripeToken,
        
    })
    .then((customer) => {
 
        return stripe.paymentIntents.create({
            amount: total,     // Charging Rs 25
            description: 'Web Development Product',
            currency: 'inr',
            customer: customer.id,
            receipt_email:customer.email
        });
    })
    .then((charge) => {
        req.session.stripeEmail=stripeEmail
        req.session.stripeToken=stripeToken
        req.session.stripeTokenType=stripeTokenType
        // console.log(charge)
        // console.log(window.location)
        // window.location.href=`/verify_payment?transaction_id=${charge.id}`
        // console.log("in stripe in then charge block")
        return res.redirect(`/verify_payment?transaction_id=${charge.id}`)
    })
    .catch((err) => {
        // console.log("in stripe in catch block ")
        return res.render('pages/payment_error',{error:err})       // If some error occurs
    });
})

 

app.get('/single_products',(req,res)=>{
    const id=req.query.id
    connect.query(`SELECT * FROM products WHERE id=${id}`,(err,result)=>{
        if(err)
        return res.render('pages/error',{err:err})
        else 
        return res.render('pages/single_products',{result:result})
    })
})
app.get('/products',(req,res)=>{
    connect.query("SELECT * FROM products",(err,result)=>{
        if(err){
            return res.render('pages/error',{err:err})
        }
        res.render("pages/products",{result:result})
    })
})
app.get('/about',(req,res)=>{
    res.render('pages/about')
})

app.listen(3000,()=>{
    console.log("app is listening on port 3000")
})
