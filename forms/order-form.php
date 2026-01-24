<?php
// Обработка формы заказа
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Метод не разрешен']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

// Валидация данных
$errors = [];

if (empty($data['name'])) {
    $errors[] = 'Имя обязательно';
}

if (empty($data['email']) || !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Некорректный email';
}

if (empty($data['phone'])) {
    $errors[] = 'Телефон обязателен';
}

if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['errors' => $errors]);
    exit;
}

// Здесь должна быть логика сохранения заказа в БД
// и отправка уведомлений

echo json_encode([
    'success' => true,
    'message' => 'Заказ успешно создан',
    'order_id' => rand(1000, 9999)
]);
?>