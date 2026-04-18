[UdelarHITS]
El sistema a desarrollar será una plataforma web, denominada [UdelarHITS], que brindará soporte a un espacio libre de opinión.

Permitirá que sus usuarios registrados abran temas de conversación dentro de categorías temáticas, y que otros usuarios puedan sumarse a dichos temas mediante comentarios y respuestas encadenadas.

A aquellos usuarios que naveguen sin registrarse, podrán acceder a los diferentes contenidos de la plataforma sin la posibilidad de participar de forma activa. Las interacciones entre usuarios requerirán un registro.

# VISIÓN #
La plataforma [UdelaRHITS] es un espacio web orientado a la libre expresión y el intercambio de ideas entre usuarios. Su propósito es ofrecer un entorno simple, accesible y centrado en la conversación, donde las personas puedan debatir, opinar y compartir contenido de forma organizada.

Para utilizar las funcionalidades disponibles, los usuarios deben registrarse proporcionando su nickname dentro de la plataforma, junto con su nombre, correo electrónico y contraseña. El nickname y correo electrónico son únicos dentro del sistema. De manera opcional se puede agregar una biografía junto con una foto de portada y banner. Se registra la fecha de alta del usuario en el sistema. Los usuarios pueden seguir a otros usuarios para mantenerse al tanto de su actividad.

La plataforma organiza su contenido en categorías, creadas por usuarios registrados. Un usuario registrado puede crear múltiples categorías. Cada categoría representa un tema principal, que es asignado por su autor. De cada categoría interesa saber su título (único), autor, fecha de creación, estado (activa, inactiva), descripción obligatoria y contador de temas. Los usuarios pueden crear temas relacionados dentro de la categoría. De cada tema interesa saber su título (único dentro de la categoría), contenido, autor, fecha de creación, estado (activo, inactivo), y categoría a la que pertenece.

Los usuarios pueden participar activamente mediante comentarios dentro de cada tema, los comentarios pueden ser respuestas directas al tema o respuestas a otros comentarios, permitiendo conversaciones encadenadas. De cada comentario interesa saber su contenido, autor, fecha de creación, estado (visible, oculto) y, opcionalmente, el comentario que responde.

Los usuarios pueden reportar temas o comentarios por motivos de spam o incitación al odio. De cada reporte interesa saber el tema/comentario reportado, usuario que reporta, motivo y la fecha del reporte. Cuando un tema/comentario pasa a estado oculto, su autor puede iniciar una apelación. De cada apelación interesa saber el tema/comentario apelado, el título de la apelación, su justificación, la fecha de solicitud, el estado (pendiente, aceptada, rechazada) y, en caso de resolución,  la fecha.

La plataforma permite que los usuarios expresen su opinión sobre los contenidos mediante reacciones: “me gusta”, “no me gusta”, “interesante” o “gracioso”. Cada usuario puede realizar una única reacción por tema o comentario, con la posibilidad de quitar o cambiar su reacción posteriormente. De cada reacción interesa saber el tipo de reacción, autor y tema o comentario que pertenece.

# POLÍTICAS DEL SISTEMA #
[Categoría] 
• Los usuarios autores de categorías obtendrán el rol de moderador de la categoría creada. 
• Los usuarios que participen (creando temas o comentarios), obtendrán el rol de participante. 
• Los usuarios pueden reportar una categoría por spam o incitación al odio. 
• Si una categoría supera un umbral de reportes, pasará a estado [inactiva]. 
• Las categorías en estado [inactiva] no permitirán la publicación de contenido. El contenido previo a su inactivación  permanecerá visible. 
• Los moderadores pueden acceder a la lista de participantes de su categoría. 
• Los moderadores pueden eliminar su categoría, la cual pasará a estado [inactiva]. 
• La descripción de una categoría podrá ser editada por su moderador máximo una vez cada 72 horas. 
• La descripción de una categoría tendrá un historial de ediciones visible. 
• Cada categoría muestra un contador visible de temas publicados.

[Tema] 
• Solo el autor puede eliminar su propio tema, el cual pasará a estado [inactivo]. 
• Los usuarios pueden reportar un tema por spam o incitación al odio. 
• Si un tema supera un umbral de reportes, pasará a estado [inactivo]. 
• Los temas en estado [inactivo] no permitirán la publicación de contenido. El contenido previo a su inactivación permanecerá visible.

[Comentarios] 
• Los comentarios se pueden publicar tanto en categorías como temas 
• Los comentarios se publicarán de forma inmediata en estado [visible]. 
• Solo el autor puede eliminar su propio comentario. 
• Los usuarios pueden reportar un comentario por spam o incitación al odio. 
• Si un comentario supera un umbral de reportes, pasará a estado [oculto]. 
• El autor puede editar su comentario, manteniendo un historial de ediciones visible.

[Reportes] 
• Cada usuario puede reportar una única vez un mismo comentario o tema.

[Apelaciones] 
• El autor de un comentario [oculto] podrá realizar una apelación para que vuelva a estado [visible]. Ésta será evaluada por un administrador del sistema. 
• El autor de un tema [inactivo] podrá realizar una apelación para que vuelva a estado [activo]. Ésta será evaluada por un administrador del sistema.

# ACTORES # [posible modificación]
• Administrador: Usuario con privilegios. 

• Visitante: usuario que accede a la aplicación web sin haber iniciado sesión como un usuario registrado.

• Usuario: usuario registrado que inició sesión en el sistema y no la cerró. Los usuarios registrados disponen de funcionalidades que no tienen los visitantes.

# REQUERIMIENTOS FUNCIONALES # 
[Usuario] 
Caso de uso: Registrar usuario 
Actores: Usuario
Descripción: El caso de uso comienza cuando el usuario desea registrarse en el sistema. El sistema solicita nickname, nombre, email, contraseña, confirmación de contraseña. El sistema verifica que nickname y email sean únicos, que la contraseña contenga al menos 8 caracteres y que coincida con la confirmación de contraseña. En caso de éxito, se crea el usuario; de lo contrario, el usuario puede reingresar los datos o cancelar el caso de uso. [DONE] [a_menos_de_confirmación_de_contraseña][a_menos_de_historial_de_edición]     

Caso de uso: Consulta de usuarios 
Actores: Administrador del sistema  
Descripción: El caso de uso comienza cuando el administrador desea consultar el perfil de un usuario. El sistema lista todos los usuarios y el administrador selecciona uno, el sistema muestra sus datos personales, junto con la lista de: categorías creadas, seguidores y seguidos. [DONE]

Caso de uso: Mostrar perfil de usuario
Actores: Usuario
Descripción: El caso de uso comienza cuando el usuario desea visitar su perfil. Para ello selecciona su perfil y se despliegan sus datos personales: nickname, nombre, email y biografía. Junto con la posibilidad de edición [DONE] 

Caso de uso: Modificar perfil de usuario 
Actores: Usuario 
Descripción: El caso de uso comienza cuando el usuario desea modificar su perfil. Para ello selecciona su perfil y edita el dato deseado, el sistema permite editar su nombre, biografía y foto de perfil. Cuando termina la edición el sistema guarda los cambios. (El nickname y email no se modifican por integridad). [DONE] [a_menos_de_poder_editar_su_foto_de_perfil_sin_necesidad_de_url]   

Caso de uso: Eliminar usuario 
Actores: Administrador del sistema 
Descripción: El caso de uso comienza cuando el administrador desdea eliminar un usuario. El sistema lista los usuarios y el administrador selecciona uno. El usuario y toda su información vinculada se eliminan del sistema. [DONE]

Caso de uso: Modificar estado de usuario
Actores: Administrador del sistema 
Descripción: El caso de uso comienza cuando el administrador desea modificar el estado de un usuario. El sistema lista los usuarios y el administrador selecciona uno, el sistema indica el estado actual del usuario y despliega una lista de estados a cambiar; el administrador selecciona uno y el sistema modifica el estado del usuario. [TODO]

[Categoría] 
Caso de uso: Crear categoría 
Actores: Usuario 
Descripción: El caso de uso comienza cuando el usuario desea crear una nueva categoría. El sistema solicita título, descripción y etiqueta (una o varias de las existentes). El sistema verifica que el título sea único, que se haya proporcionado descripción y al menos una de las etiquetas. En caso de éxito se crea la categoría en estado activa, de lo contrario, el usuario puede reingresar los datos o cancelar el caso de uso. [DONE]

Caso de uso: Consulta de categorías 
Actores: Administrador del sistema 
Descripción: El caso de uso comienza cuando el administrador desea consultar una categoría. El sistema lista todas las categorías y el administrador selecciona una, el sistema devuelve todos sus datos (título, descripción, etiquetas, contador de temas, estado y fecha de creación), junto con la lista de temas que posee la categoría. [DONE]

Caso de uso: Consulta de categorías 
Actores: Usuario
Descripción: El caso de uso comienza cuando el usuario desea consultar sus categorías. El sistema lista todas las categorías creadas por el usuario. [DONE]

Caso de uso: Modificar categoría 
Actores: Usuario 
Descripción: El caso de uso comienza cuando el usuario desea modificar una categoría. El sistema lista todas las categorías creadas por el usuario y el usuario selecciona una, el sistema permite editar su descripción y etiquetas. Cuando termina la edición, el sistema guarda los cambios. (El título no se modifica por integridad) [DONE] [a_menos_de_restricción_horaria]

Caso de uso: Desactivar categoría 
Actores: Usuario 
Descripción: El caso de uso comienza cuando el usuario desdea eliminar una categoría. El sistema lista las categorías y el usuario selecciona una, el sistema pide confirmación de la categoría a eliminar. Al aceptar, la categoría pasa a estado inactiva pero contiene toda la información vinculada, en caso de cancelar, finaliza el caso de uso. [DONE]

Caso de uso: Activar categoría 
Actores: Usuario 
Descripción: El caso de uso comienza cuando el usuario desdea activar su categoría eliminada. El sistema lista las categorías creadas por el usuario, el usuario selecciona una, y la categoría pasa a estado activa [DONE]

Caso de uso: Mostrar participantes de categoría
Actores: Usuario
Descripción: El caso de uso comienza cuando el usuario moderador de su categoría desdea obtener los usuarios que participan. El sistema lista la lista de usuarios participantes. [TODO]

[Tema] 
Caso de uso: Crear tema 
Actores: Usuario 
Descripción: El caso de uso comienza cuando el usuario desea crear un nuevo tema dentro de una categoría. El sistema solicita título y contenido. El sistema verifica que el título sea único dentro de la categoría y que se haya proporcionado contenido. En caso de éxito se crea el tema en estado activa, de lo contrario, el usuario puede reingresar los datos o cancelar el caso de uso. [DONE]

Caso de uso: Consulta de temas 
Actores: usuario del sistema 
Descripción: El caso de uso comienza cuando el usuario desea consultar un tema. El sistema lista todos los temas y el usuario selecciona uno, el sistema devuelve todos sus datos (título, contenido, estado y fecha de creación), junto con la lista de comentarios y usuarios que han participado mediante comentarios. [TODO]

Caso de uso: Modificar tema 
Actores: usuario del sistema 
Descripción: El caso de uso comienza cuando el usuario desea modificar un tema. El sistema lista todos los temas y el usuario selecciona uno, el sistema permite editar su contenido. Cuando termina la edición, el sistema guarda los cambios. (El título y estado no se modifican por integridad) [TODO]

Caso de uso: Eliminar tema 
Actores: Usuario 
Descripción: El caso de uso comienza cuando el usuario desdea eliminar un tema. El sistema lista los temas y el usuario selecciona uno, el sistema pide confirmación del tema a eliminar. Al aceptar, el tema y toda su información vinculada se eliminan del sistema, en caso de cancelar, finaliza el caso de uso.[TODO]

Caso de uso: Modificar estado de tema 
Actores: Usuario 
Descripción: El caso de uso comienza cuando el usuario desea modificar el estado de un tema. El sistema lista los temas y el usuario selecciona uno, el sistema indica el estado actual del tema y despliega una lista de estados a cambiar; el usuario selecciona uno y el sistema modifica el estado del tema. [TODO]

[Comentario] 
Caso de uso: Consulta de comentario 
Actores: Usuario 
Descripción: El caso de uso comienza cuando el usuario desea consultar un comentario. El sistema lista los usuarios y el usuario selecciona uno, el sistema lista los comentarios publicados por el usuario y el usuario selecciona uno. El sistema despliega la fecha de creación y contenido del comentario seleccionado. [TODO]

Caso de uso: Eliminar comentario 
Actores: Usuario 
Descripción: El caso de uso comienza cuando el usuario desea eliminar un comentario. El sistema lista los usuarios y el usuario selecciona uno, el sistema lista los comentarios publicados por el usuario y el usuario selecciona uno, el sistema pide confirmación del comentario a eliminar. Al aceptar, el comentario y toda su información vinculada se eliminan del sistema, en caso de cancelar, finaliza el caso de uso. [TODO]

Caso de uso: Modificar estado de comentario 
Actores: Usuario 
Descripción: El caso de uso comienza cuando el usuario desea modificar el estado de un comentario. El sistema lista los usuarios y el usuario selecciona uno, el sistema lista los comentarios publicados por el usuario y el usuario selecciona uno, el sistema indica el estado actual del comentario y despliega una lista de estados a cambiar; el usuario selecciona uno y el sistema modifica el estado del comentario. [TODO]

Caso de uso: Comentarios visibles por usuario 
Actores: Usuario 
Descripción: El caso de uso comienza cuando el usuario desea consultar los comentarios visibles de un usuario. El sistema lista los usuarios y el usuario selecciona uno, el sistema despliega los comentarios en estado visible del usuario seleccionado. [TODO]

[Apelaciones] 
Caso de uso: Resolver apelación 
Actores: Administrador del sistema 
Descripción: El caso de uso comienza cuando el administrador desea resolver una apelación. El sistema lista las apelaciones en estado pendiente y el usuario selecciona una. El sistema muestra su justificación junto con el comentario o tema que fue reportado, con la opción de aceptar o rechazar. En caso de aceptar, se modifica el estado de la apelación a aceptada y se modifica el estado del comentario o tema del cuál se apeló a visible o activo respectivamente. En caso de rechazar, se modifica el estado de la apelación a rechazada y finaliza el caso de uso. [TODO]

---------------------------------------------------------------------------------------------------------------------------

--Aclaraciones--
La eliminación implica la remoción definitiva de la entidad del sistema, mientras que la modificación de estado permite ocultar o inactivar contenido sin eliminarlo.

# -- updates -- #
A futuro, la plataforma podrá incorporar funcionalidades adicionales como marcación de temas favoritos, estadísticas de interacción, reputación de usuarios o recomendaciones personalizadas. Habrá un ranking de comentarios mejores valorados.