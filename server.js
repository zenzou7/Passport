const express = require('express');
const session = require('express-session');

const MongoStore = require('connect-mongo');

const { Router } = require('express');
const router = Router();

const multer = require('multer');
const { normalize, schema } = require('normalizr');
const upload = multer();

const daoMemoria = require('./src/DAO/daoMemoriaProductos.js');
const classProductos = new daoMemoria();

const mensajesDaoMongo = require('./src/DAO/daoMongoMensajes.js');
const classMsgs = new mensajesDaoMongo();

const bcrypt = require('bcrypt');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const Usuarios = require('./models/users.js');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//Passport
function isValidPassword(user, password) {
  return bcrypt.compareSync(password, user.password);
}

function createHash(password) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(10), null);
}

passport.use(
  'login',
  new LocalStrategy((username, password, done) => {
    Usuarios.findOne({ username }, (err, user) => {
      if (err) return done(err);

      if (!user) {
        console.log('User Not Found with username ' + username);
        return done(null, false);
      }

      if (!isValidPassword(user, password)) {
        console.log('Invalid Password');
        return done(null, false);
      }

      return done(null, user);
    });
  })
);

passport.use(
  'signup',
  new LocalStrategy(
    {
      passReqToCallback: true,
    },
    (req, username, password, done) => {
      Usuarios.findOne({ username: username }, function (err, user) {
        if (err) {
          console.log('Error in SignUp: ' + err);
          return done(err);
        }

        if (user) {
          console.log('User already exists');
          return done(null, false);
        }

        const newUser = {
          username: username,
          password: createHash(password),
        };
        Usuarios.create(newUser, (err, userWithId) => {
          if (err) {
            console.log('Error in Saving user: ' + err);
            return done(err);
          }
          console.log(user);
          console.log('User Registration succesful');
          return done(null, userWithId);
        });
      });
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser((id, done) => {
  Usuarios.findById(id, done);
});

app.use(passport.initialize());

//Session
app.use(
  session({
    store: MongoStore.create({
      mongoUrl: 'mongodb+srv://Leo:62742@coder-backend.3x5udc7.mongodb.net/test',
      mongoOptions: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
    }),
    secret: '1234',
    resave: true,
    saveUninitialized: false,
    cookie: { expires: 60000 },
  })
);

//Socket.io
const httpServer = require('http').createServer(app);
const io = require('socket.io')(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}`);
});

app.set('view engine', 'ejs');

app.use('/api/productos', router);

app.get('/', async (req, res) => {
  try {
    const prods = await classProductos.getAll();

    res.render('pages/form', { products: prods });
  } catch (err) {
    console.log(err);
  }
});

router.get('/', async (req, res) => {
  try {
    const prods = await classProductos.getAll();

    res.render('pages/productos', { products: prods });
  } catch (err) {
    console.log(err);
  }
});

router.post('/form', upload.none(), (req, res) => {
  try {
    const body = req.body;
    classProductos.save(body);
    if (body) {
    } else {
      res.json({ error: true, msg: 'Producto no agregado' });
    }
  } catch (err) {
    console.log(err);
  }
});

//LOGIN

router.post('/login', upload.none(), passport.authenticate('login', { failureRedirect: '/api/productos/fail/signup' }), (req, res) => {
  try {
    const { username, password } = req.user;
    const user = { username, password };
    res.render('pages/profile', { user });
  } catch (err) {
    console.log(err);
  }
});

router.get('/form', async (req, res) => {
  try {
    const prods = await classProductos.getAll();

    res.render('pages/form', { products: prods });
  } catch (err) {
    console.log(err);
  }
});

router.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    const { username, password } = req.user;
    const user = { username, password };
    res.render('pages/profile', { user });
  } else {
    res.render('pages/login');
  }
});

router.get('/logout', (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        res.send('no pudo deslogear');
      } else {
        res.render('pages/logout');
      }
    });
  } catch (err) {
    console.log(err);
  }
});

router.get('/signup', (req, res) => {
  if (req.isAuthenticated()) {
    const { username, password } = req.user;
    const user = { username, password };
    res.render('pages/profile', { user });
  } else {
    res.render('pages/signup');
  }
});

router.post('/signup', passport.authenticate('signup', { failureRedirect: '/api/productos/fail/signup' }), (req, res) => {
  const { username, password } = req.body;
  const user = { username, password };
  res.render('pages/profile', { user });
});

router.get('/fail/login', (req, res) => {
  res.render('pages/faillogin', {});
});

router.get('/fail/signup', (req, res) => {
  res.render('pages/failsignup', {});
});

//SOCKET
io.on('connection', async (socket) => {
  console.log('Usuario conectado');

  socket.on('msg', async (data) => {
    let fecha = new Date();
    /* email: data.email,
      mensaje: data.mensaje,
      fecha: fecha.getDate() + '/' + (fecha.getMonth() + 1) + '/' + fecha.getFullYear(),
      hora: fecha.getHours() + ':' + fecha.getMinutes() + ':' + fecha.getSeconds(), */
    const msg = {
      author: {
        id: data.email,
        nombre: data.nombre,
        apellido: data.apellido,
        edad: data.edad,
        avatar: data.avatar,
      },
      text: {
        mensaje: data.mensaje,
        fecha: fecha.getDate() + '/' + (fecha.getMonth() + 1) + '/' + fecha.getFullYear(),
        hora: fecha.getHours() + ':' + fecha.getMinutes() + ':' + fecha.getSeconds(),
      },
    };

    classMsgs.save(msg);
    const allData = await classMsgs.getAll();

    const mensajeSchema = new schema.Entity('mensaje');
    const authorSchema = new schema.Entity(
      'author',
      {
        mensaje: mensajeSchema,
      },
      { idAttribute: 'email' }
    );
    const chatSchema = new schema.Entity('chat', {
      author: [authorSchema],
    });
    const normalizado = normalize({ id: 'chatHistory', messages: allData }, chatSchema);
    console.log(JSON.stringify(normalizado));

    io.sockets.emit('msg-list', { normalizado: normalizado });
  });

  socket.on('sendTable', async (data) => {
    classProductos.save(data);

    try {
      const productos = await classProductos.getAll();
      socket.emit('prods', productos);
    } catch (err) {
      console.log(err);
    }
  });
});
