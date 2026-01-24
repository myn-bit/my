<?php
// Обработка формы обратной связи
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Метод не разрешен']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

// Валидация
if (empty($data['message'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Сообщение обязательно']);
    exit;
}

// Отправка email (заглушка)
$to = 'info@pcstore.ru';
$subject = 'Новое сообщение с сайта PC Store';
$message = "Имя: " . ($data['name'] ?? 'Не указано') . "
";
$message .= "Email: " . ($data['email'] ?? 'Не указано') . "
";
$message .= "Сообщение: " . $data['message'];

// В реальном проекте использовать mail() или библиотеку для отправки email
// mail($to, $subject, $message);

echo json_encode([
    'success' => true,
    'message' => 'Сообщение отправлено'
]);
?>