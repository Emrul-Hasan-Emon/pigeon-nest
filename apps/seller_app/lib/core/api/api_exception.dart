import 'package:dio/dio.dart';

/// An error from the server, with a message that is safe to show the seller.
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  bool get isUnauthorized => statusCode == 401;

  /// The request never got an answer (no internet, or the server was too slow). Safe to try a read again.
  bool get isNetwork => statusCode == null;

  factory ApiException.from(Object error) {
    if (error is ApiException) return error;
    if (error is DioException) {
      final data = error.response?.data;
      final status = error.response?.statusCode;
      if (data is Map && data['message'] != null) {
        final m = data['message'];
        // Validation errors come as a list of sentences.
        return ApiException(m is List ? m.join('\n') : m.toString(), statusCode: status);
      }
      if (error.type == DioExceptionType.connectionError || error.type == DioExceptionType.connectionTimeout) {
        return ApiException('We could not reach the server. Check your internet and try again.');
      }
      if (error.type == DioExceptionType.receiveTimeout || error.type == DioExceptionType.sendTimeout) {
        return ApiException('The server is slow to answer. Please try again.');
      }
      return ApiException('Something went wrong. Please try again.', statusCode: status);
    }
    return ApiException('Something went wrong. Please try again.');
  }

  @override
  String toString() => message;
}
